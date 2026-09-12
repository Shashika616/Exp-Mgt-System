import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { schema, withContext, type Tx } from "./db";
import type { AuthContext } from "@/lib/authz/policy";

export type NotifyInput = {
  userIds: string[];
  orgId: string;
  ticketId?: string | null;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
  /** queue an email (the notify.flush job sends it) */
  email?: boolean;
  /** never notify the actor about their own action */
  excludeUserId?: string | null;
};

/** Insert in-app notifications (and queue emails) in the current transaction. Deduplicates recipients. */
export async function notifyInTx(tx: Tx, input: NotifyInput): Promise<number> {
  const ids = [...new Set(input.userIds.filter((id) => id && id !== input.excludeUserId))];
  if (ids.length === 0) return 0;
  // Only active users receive notifications
  const active = await tx
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(inArray(schema.users.id, ids), eq(schema.users.status, "active"), isNull(schema.users.deletedAt)));
  if (active.length === 0) return 0;
  await tx.insert(schema.notifications).values(
    active.map((u) => ({
      userId: u.id,
      orgId: input.orgId,
      ticketId: input.ticketId ?? null,
      kind: input.kind,
      title: input.title.slice(0, 200),
      body: input.body?.slice(0, 500) ?? null,
      href: input.href ?? null,
      emailStatus: input.email ? "queued" : "skipped",
    })),
  );
  return active.length;
}

export async function listNotifications(ctx: AuthContext, limit = 20) {
  return withContext(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, ctx.userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit);
    const [u] = await tx
      .select({ unread: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, ctx.userId), isNull(schema.notifications.readAt)));
    return { rows, unread: u?.unread ?? 0 };
  });
}

export async function markNotificationsRead(ctx: AuthContext, ids: string[] | "all"): Promise<void> {
  await withContext(ctx, async (tx) => {
    const where = ids === "all" ? and(eq(schema.notifications.userId, ctx.userId), isNull(schema.notifications.readAt)) : and(eq(schema.notifications.userId, ctx.userId), inArray(schema.notifications.id, ids));
    await tx.update(schema.notifications).set({ readAt: new Date() }).where(where);
  });
}

/** Staff recipients by role (leads + admins for breach/blocked/submitted notifications). */
export async function staffUserIdsByRole(tx: Tx, roles: string[]): Promise<string[]> {
  const rows = await tx
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(inArray(schema.users.roleId, roles), eq(schema.users.status, "active"), isNull(schema.users.deletedAt)));
  return rows.map((r) => r.id);
}
