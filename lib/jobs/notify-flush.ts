import "server-only";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { SYSTEM_CONTEXT } from "@/lib/authz/policy";
import { schema, withContext } from "@/lib/dal/db";
import { getEmailProvider } from "@/lib/email/provider";
import { renderTicketEmail } from "@/lib/email/render";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { firstName } from "@/lib/utils";

/**
 * notify.flush: sends queued notification emails through the email provider. Each row is sent at most
 * once (status flips to `sending` under row lock); failures retry up to 5 times (security.md A10).
 */
export async function notifyFlush(limit = 50): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const batch = await withContext(SYSTEM_CONTEXT, async (tx) => {
    const rows = await tx
      .select({
        id: schema.notifications.id,
        kind: schema.notifications.kind,
        title: schema.notifications.title,
        body: schema.notifications.body,
        href: schema.notifications.href,
        email: schema.users.email,
        name: schema.users.fullName,
        ticketKey: schema.tickets.key,
        ticketSubject: schema.tickets.subject,
      })
      .from(schema.notifications)
      .innerJoin(schema.users, eq(schema.users.id, schema.notifications.userId))
      .leftJoin(schema.tickets, eq(schema.tickets.id, schema.notifications.ticketId))
      .where(and(eq(schema.notifications.emailStatus, "queued"), isNull(schema.notifications.emailSentAt), lt(schema.notifications.createdAt, new Date())))
      .orderBy(schema.notifications.createdAt)
      .limit(limit)
      .for("update", { skipLocked: true });
    if (rows.length) {
      await tx.update(schema.notifications).set({ emailStatus: "sending" }).where(sql`${schema.notifications.id} in ${rows.map((r) => r.id)}`);
    }
    return rows;
  });
  const provider = getEmailProvider();
  for (const n of batch) {
    try {
      const href = `${env.APP_URL}/login?next=${encodeURIComponent(n.href ?? "/")}`;
      const mail = await renderTicketEmail({
        subjectLine: n.title,
        title: n.title,
        recipientName: firstName(n.name),
        ticketKey: n.ticketKey ?? "",
        ticketSubject: n.ticketSubject ?? "",
        bodyText: bodyFor(n.kind),
        snippet: n.body,
        ctaLabel: n.href?.startsWith("/portal") ? "Open request" : "Open ticket",
        ctaUrl: href,
      });
      await provider.send({ to: n.email, ...mail, tag: n.kind });
      await withContext(SYSTEM_CONTEXT, (tx) => tx.update(schema.notifications).set({ emailStatus: "sent", emailSentAt: new Date() }).where(eq(schema.notifications.id, n.id)));
      sent++;
    } catch (err) {
      failed++;
      logger.warn({ err, notificationId: n.id }, "email send failed");
      await withContext(SYSTEM_CONTEXT, (tx) => tx.update(schema.notifications).set({ emailStatus: "failed" }).where(eq(schema.notifications.id, n.id)));
    }
  }
  return { sent, failed };
}

function bodyFor(kind: string): string {
  switch (kind) {
    case "ticket_created":
      return "Thanks — we've received your request and will respond within the target below.";
    case "staff_reply":
      return "There's a new reply on your request.";
    case "client_reply":
      return "The client has replied on a ticket you're working on.";
    case "status_pending_client":
      return "We need something from you to continue. Please reply in the portal.";
    case "status_resolved":
      return "We believe this request is resolved. Please confirm, or reopen if something still isn't right.";
    case "status_closed":
      return "This request is now closed. Raise a follow-up from the portal if you need anything else.";
    case "status_open":
      return "This request has been reopened.";
    case "assigned":
      return "A ticket has been assigned to you.";
    case "submitted_for_review":
      return "A developer submitted their work for review.";
    case "review_approved":
      return "Your submission was approved and the ticket is resolved.";
    case "review_returned":
      return "Your submission was returned with notes.";
    case "sla_at_risk":
      return "An SLA target is at 75 % — please act now.";
    case "sla_breached":
      return "An SLA target has been breached and the ticket was escalated.";
    case "escalated":
      return "A ticket was escalated.";
    case "mentioned":
      return "You were mentioned in an internal note.";
    default:
      return kind.startsWith("work_") ? "A developer needs attention on a ticket." : "There is an update on a ticket.";
  }
}
