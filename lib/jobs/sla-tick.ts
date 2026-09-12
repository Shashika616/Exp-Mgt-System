import "server-only";
import { eq, sql } from "drizzle-orm";
import { SYSTEM_CONTEXT } from "@/lib/authz/policy";
import { schema, withContext } from "@/lib/dal/db";
import { emitEvent } from "@/lib/dal/events";
import { notifyInTx, staffUserIdsByRole } from "@/lib/dal/notifications";
import { markTimer, policyForOrg, runningTimers } from "@/lib/dal/sla";
import { tick } from "@/lib/domain/sla-timers";
import { logger } from "@/lib/logger";

/**
 * sla.tick (architecture.md §6): for running timers compute elapsed, mark at-risk (75 %) / breached (100 %),
 * emit events, notify assignee + leads (+ admins on breach), bump escalation_level on breach.
 */
export async function slaTick(now = new Date()): Promise<{ atRisk: number; breached: number }> {
  let atRisk = 0;
  let breached = 0;
  await withContext(SYSTEM_CONTEXT, async (tx) => {
    const rows = await runningTimers(tx);
    const policies = new Map<string, Awaited<ReturnType<typeof policyForOrg>>>();
    const leads = await staffUserIdsByRole(tx, ["lead"]);
    const admins = await staffUserIdsByRole(tx, ["admin"]);
    for (const r of rows) {
      let policy = policies.get(r.ticketOrgId);
      if (!policy) {
        policy = await policyForOrg(tx, r.ticketOrgId);
        policies.set(r.ticketOrgId, policy);
      }
      const t = r.timer;
      const result = tick(
        { metric: t.metric, calendar: t.calendar as "24x7" | "business", targetMinutes: t.targetMinutes, startedAt: t.startedAt, pausedAt: t.pausedAt, elapsedMs: Number(t.elapsedMs), dueAt: t.dueAt, atRiskNotified: t.atRiskNotified, breachedAt: t.breachedAt, metAt: t.metAt },
        now,
        policy.calendar,
      );
      const metricLabel = t.metric === "first_response" ? "first response" : "resolution";
      if (result.nowAtRisk) {
        atRisk++;
        await markTimer(tx, t.id, { atRiskNotified: true });
        await emitEvent(tx, SYSTEM_CONTEXT, { ticketId: r.ticketId, orgId: r.ticketOrgId, kind: "sla_at_risk", data: { metric: t.metric, dueAt: t.dueAt.toISOString() } });
        await notifyInTx(tx, { userIds: [...(r.assigneeId ? [r.assigneeId] : []), ...leads], orgId: r.ticketOrgId, ticketId: r.ticketId, kind: "sla_at_risk", title: `${r.ticketKey} ${metricLabel} SLA at risk`, body: `Due ${t.dueAt.toISOString()}, ${r.subject}`, href: `/app/tickets/${r.ticketKey}`, email: true });
      }
      if (result.nowBreached) {
        breached++;
        await markTimer(tx, t.id, { breachedAt: now, atRiskNotified: true });
        const [tk] = await tx
          .update(schema.tickets)
          .set({ escalationLevel: sql`least(3, ${schema.tickets.escalationLevel} + 1)`, escalatedAt: now })
          .where(eq(schema.tickets.id, r.ticketId))
          .returning({ level: schema.tickets.escalationLevel });
        await emitEvent(tx, SYSTEM_CONTEXT, { ticketId: r.ticketId, orgId: r.ticketOrgId, kind: "sla_breached", data: { metric: t.metric, dueAt: t.dueAt.toISOString() } });
        await emitEvent(tx, SYSTEM_CONTEXT, { ticketId: r.ticketId, orgId: r.ticketOrgId, kind: "escalated", data: { level: tk?.level ?? 1, reason: `SLA breached (${metricLabel})` } });
        await notifyInTx(tx, { userIds: [...(r.assigneeId ? [r.assigneeId] : []), ...leads, ...admins], orgId: r.ticketOrgId, ticketId: r.ticketId, kind: "sla_breached", title: `${r.ticketKey} ${metricLabel} SLA breached: escalated to level ${tk?.level ?? 1}`, body: r.subject, href: `/app/tickets/${r.ticketKey}`, email: true });
      }
    }
  });
  if (atRisk || breached) logger.info({ atRisk, breached }, "sla.tick");
  return { atRisk, breached };
}
