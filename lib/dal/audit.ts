import "server-only";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { schema, withContext, type Tx } from "./db";
import type { AuthContext } from "@/lib/authz/policy";

export type AuditEntry = {
  action: string;
  entityType?: string;
  entityId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  orgId?: string | null;
};

/** Append a non-ticket audit row inside an existing transaction. */
export async function auditInTx(tx: Tx, ctx: AuthContext, e: AuditEntry): Promise<void> {
  await tx.insert(schema.auditLog).values({
    orgId: e.orgId === undefined ? ctx.orgId : e.orgId,
    actorId: ctx.role === "system" ? null : ctx.userId,
    actorEmail: ctx.email,
    action: e.action,
    entityType: e.entityType ?? null,
    entityId: e.entityId ?? null,
    before: e.before ?? null,
    after: e.after ?? null,
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent?.slice(0, 500) ?? null,
    requestId: ctx.requestId ?? null,
  });
}

export async function audit(ctx: AuthContext, e: AuditEntry): Promise<void> {
  await withContext(ctx, (tx) => auditInTx(tx, ctx, e));
}

/** Cross-tenant / forbidden access attempts (security.md A01): logged as `access_denied`, caller returns 404. */
export async function logAccessDenied(ctx: AuthContext, entityType: string, entityId: string): Promise<void> {
  await audit(ctx, { action: "access_denied", entityType, entityId }).catch(() => undefined);
}

export type AuditFilter = { action?: string; actorEmail?: string; from?: Date; to?: Date; limit?: number; offset?: number };

export async function listAudit(ctx: AuthContext, f: AuditFilter = {}) {
  return withContext(ctx, async (tx) => {
    const where = and(
      f.action ? eq(schema.auditLog.action, f.action) : undefined,
      f.actorEmail ? sql`${schema.auditLog.actorEmail} ilike ${"%" + f.actorEmail + "%"}` : undefined,
      f.from ? gte(schema.auditLog.createdAt, f.from) : undefined,
      f.to ? lte(schema.auditLog.createdAt, f.to) : undefined,
    );
    const rows = await tx
      .select()
      .from(schema.auditLog)
      .where(where)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(Math.min(f.limit ?? 50, 100))
      .offset(f.offset ?? 0);
    const [c] = await tx.select({ count: sql<number>`count(*)::int` }).from(schema.auditLog).where(where);
    return { rows, count: c?.count ?? 0 };
  });
}
