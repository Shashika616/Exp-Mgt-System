import "server-only";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { schema, withContext, type Tx } from "./db";
import { SYSTEM_CONTEXT, type AuthContext } from "@/lib/authz/policy";
import { AppError, notFound } from "@/lib/errors";
import type { Role } from "@/lib/domain/types";
import { auditInTx } from "./audit";
import { randomToken, sha256 } from "@/lib/auth/crypto";

export const userSummary = {
  id: schema.users.id,
  fullName: schema.users.fullName,
  email: schema.users.email,
  roleId: schema.users.roleId,
  orgId: schema.users.orgId,
  status: schema.users.status,
  avatarUrl: schema.users.avatarUrl,
  mfaEnrolled: schema.users.mfaEnrolled,
  lastSeenAt: schema.users.lastSeenAt,
  createdAt: schema.users.createdAt,
};

export async function getUser(ctx: AuthContext, id: string) {
  return withContext(ctx, async (tx) => {
    const [row] = await tx.select(userSummary).from(schema.users).where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt))).limit(1);
    return row ?? null;
  });
}

export async function listStaff(ctx: AuthContext, roles?: Role[]) {
  return withContext(ctx, (tx) =>
    tx
      .select(userSummary)
      .from(schema.users)
      .innerJoin(schema.organisations, eq(schema.organisations.id, schema.users.orgId))
      .where(and(eq(schema.organisations.type, "staff"), isNull(schema.users.deletedAt), roles ? inArray(schema.users.roleId, roles) : undefined))
      .orderBy(asc(schema.users.fullName)),
  );
}

export async function listOrgContacts(ctx: AuthContext, orgId: string) {
  return withContext(ctx, (tx) =>
    tx
      .select(userSummary)
      .from(schema.users)
      .where(and(eq(schema.users.orgId, orgId), isNull(schema.users.deletedAt)))
      .orderBy(asc(schema.users.fullName)),
  );
}

/** Assignee workload hint (FR-AG-05): open tickets per staff user. */
export async function staffWorkload(ctx: AuthContext) {
  return withContext(ctx, async (tx) => {
    const rows = await tx
      .select({ assigneeId: schema.tickets.assigneeId, count: sql<number>`count(*)::int` })
      .from(schema.tickets)
      .where(and(inArray(schema.tickets.status, ["new", "open", "in_progress", "in_review", "pending_client", "on_hold"]), isNull(schema.tickets.deletedAt)))
      .groupBy(schema.tickets.assigneeId);
    return Object.fromEntries(rows.filter((r) => r.assigneeId).map((r) => [r.assigneeId!, r.count])) as Record<string, number>;
  });
}

export type InviteInput = { email: string; fullName: string; roleId: Role; orgId: string; phone?: string | null };

/**
 * Create an invited user + single-use hashed invitation token (FR-AUTH-02/04). Returns the raw token
 * exactly once so the caller can email it. Role/org constraints are enforced by the caller (action) and RLS.
 */
export async function inviteUser(ctx: AuthContext, input: InviteInput, opts: { authProviderId?: string | null } = {}) {
  return withContext(ctx, async (tx) => {
    const [existing] = await tx.select({ id: schema.users.id, status: schema.users.status }).from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
    if (existing && existing.status !== "invited") throw new AppError("conflict", "A user with this email already exists.");
    const now = new Date();
    let userId: string;
    if (existing) {
      userId = existing.id;
      await tx.update(schema.users).set({ fullName: input.fullName, roleId: input.roleId, orgId: input.orgId, phone: input.phone ?? null }).where(eq(schema.users.id, userId));
    } else {
      const [row] = await tx
        .insert(schema.users)
        .values({ email: input.email, fullName: input.fullName, roleId: input.roleId, orgId: input.orgId, phone: input.phone ?? null, status: "invited", authProviderId: opts.authProviderId ?? null })
        .returning({ id: schema.users.id });
      userId = row!.id;
    }
    // Local provider identities are keyed by users.id
    if (!opts.authProviderId) await tx.update(schema.users).set({ authProviderId: userId }).where(and(eq(schema.users.id, userId), isNull(schema.users.authProviderId)));
    const token = randomToken();
    await tx.insert(schema.invitations).values({ userId, orgId: input.orgId, invitedBy: ctx.userId, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000) });
    await auditInTx(tx, ctx, { action: "user.invited", entityType: "user", entityId: userId, orgId: input.orgId, after: { email: input.email, roleId: input.roleId } });
    return { userId, token };
  });
}

export async function findInvitation(token: string) {
  return withContext(SYSTEM_CONTEXT, async (tx) => {
    const [row] = await tx
      .select({
        id: schema.invitations.id,
        userId: schema.invitations.userId,
        expiresAt: schema.invitations.expiresAt,
        usedAt: schema.invitations.usedAt,
        email: schema.users.email,
        fullName: schema.users.fullName,
        roleId: schema.users.roleId,
        status: schema.users.status,
        orgName: schema.organisations.name,
        orgType: schema.organisations.type,
        authProviderId: schema.users.authProviderId,
      })
      .from(schema.invitations)
      .innerJoin(schema.users, eq(schema.users.id, schema.invitations.userId))
      .innerJoin(schema.organisations, eq(schema.organisations.id, schema.users.orgId))
      .where(eq(schema.invitations.tokenHash, sha256(token)))
      .limit(1);
    if (!row) return null;
    const state = row.usedAt ? "used" : row.expiresAt < new Date() ? "expired" : "valid";
    return { ...row, state } as const;
  });
}

export async function acceptInvitation(token: string): Promise<{ userId: string; roleId: Role; orgType: "staff" | "client" } | null> {
  return withContext(SYSTEM_CONTEXT, async (tx) => {
    const [row] = await tx
      .select({ id: schema.invitations.id, userId: schema.invitations.userId, expiresAt: schema.invitations.expiresAt, usedAt: schema.invitations.usedAt })
      .from(schema.invitations)
      .where(eq(schema.invitations.tokenHash, sha256(token)))
      .limit(1);
    if (!row || row.usedAt || row.expiresAt < new Date()) return null;
    await tx.update(schema.invitations).set({ usedAt: new Date() }).where(eq(schema.invitations.id, row.id));
    const [user] = await tx
      .update(schema.users)
      .set({ status: "active" })
      .where(eq(schema.users.id, row.userId))
      .returning({ id: schema.users.id, roleId: schema.users.roleId, orgId: schema.users.orgId });
    const [org] = await tx.select({ type: schema.organisations.type }).from(schema.organisations).where(eq(schema.organisations.id, user!.orgId)).limit(1);
    await auditInTx(tx, SYSTEM_CONTEXT, { action: "user.invitation_accepted", entityType: "user", entityId: row.userId, orgId: user!.orgId });
    return { userId: user!.id, roleId: user!.roleId as Role, orgType: org!.type };
  });
}

export async function deactivateUser(ctx: AuthContext, userId: string) {
  return withContext(ctx, async (tx) => {
    if (userId === ctx.userId) throw new AppError("validation", "You cannot deactivate yourself.");
    const [target] = await tx.select({ id: schema.users.id, roleId: schema.users.roleId, orgId: schema.users.orgId, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!target) throw notFound();
    if (target.roleId === "admin") {
      const [c] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.users).where(and(eq(schema.users.roleId, "admin"), eq(schema.users.status, "active"), ne(schema.users.id, userId)));
      if ((c?.n ?? 0) === 0) throw new AppError("validation", "The last active admin cannot be deactivated.");
    }
    await tx
      .update(schema.users)
      .set({ status: "deactivated", sessionVersion: sql`${schema.users.sessionVersion} + 1` })
      .where(eq(schema.users.id, userId));
    await auditInTx(tx, ctx, { action: "user.deactivated", entityType: "user", entityId: userId, orgId: target.orgId, before: { email: target.email } });
    return target;
  });
}

export async function reactivateUser(ctx: AuthContext, userId: string) {
  return withContext(ctx, async (tx) => {
    const [target] = await tx.update(schema.users).set({ status: "active" }).where(eq(schema.users.id, userId)).returning({ id: schema.users.id, orgId: schema.users.orgId });
    if (!target) throw notFound();
    await auditInTx(tx, ctx, { action: "user.reactivated", entityType: "user", entityId: userId, orgId: target.orgId });
  });
}

export async function setUserRole(ctx: AuthContext, userId: string, roleId: Role) {
  return withContext(ctx, async (tx) => {
    if (userId === ctx.userId) throw new AppError("validation", "You cannot change your own role.");
    const [target] = await tx.select({ roleId: schema.users.roleId, orgId: schema.users.orgId, orgType: schema.organisations.type }).from(schema.users).innerJoin(schema.organisations, eq(schema.organisations.id, schema.users.orgId)).where(eq(schema.users.id, userId)).limit(1);
    if (!target) throw notFound();
    const staffRoles: Role[] = ["agent", "developer", "lead", "admin"];
    const clientRoles: Role[] = ["client_user", "client_admin"];
    if (target.orgType === "staff" ? !staffRoles.includes(roleId) : !clientRoles.includes(roleId)) throw new AppError("validation", "That role is not valid for this organisation type.");
    if (target.roleId === "admin" && roleId !== "admin") {
      const [c] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.users).where(and(eq(schema.users.roleId, "admin"), eq(schema.users.status, "active"), ne(schema.users.id, userId)));
      if ((c?.n ?? 0) === 0) throw new AppError("validation", "The last admin cannot be demoted.");
    }
    await tx.update(schema.users).set({ roleId, sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, userId));
    await auditInTx(tx, ctx, { action: "user.role_changed", entityType: "user", entityId: userId, orgId: target.orgId, before: { roleId: target.roleId }, after: { roleId } });
  });
}

export async function forceMfaReset(ctx: AuthContext, userId: string) {
  return withContext(ctx, async (tx) => {
    const [target] = await tx.update(schema.users).set({ mfaEnrolled: false, sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, userId)).returning({ orgId: schema.users.orgId, authProviderId: schema.users.authProviderId });
    if (!target) throw notFound();
    await auditInTx(tx, ctx, { action: "user.mfa_reset", entityType: "user", entityId: userId, orgId: target.orgId });
    return target;
  });
}

export async function updateProfile(ctx: AuthContext, patch: { fullName?: string; phone?: string | null; timezone?: string | null; notificationPrefs?: Record<string, unknown> }) {
  return withContext(ctx, async (tx) => {
    await tx.update(schema.users).set(patch).where(eq(schema.users.id, ctx.userId));
    await auditInTx(tx, ctx, { action: "user.profile_updated", entityType: "user", entityId: ctx.userId, after: patch });
  });
}

export async function markMfaEnrolled(userId: string) {
  await withContext(SYSTEM_CONTEXT, (tx) => tx.update(schema.users).set({ mfaEnrolled: true }).where(eq(schema.users.id, userId)));
}

export async function bumpSessionVersion(userId: string) {
  await withContext(SYSTEM_CONTEXT, (tx) => tx.update(schema.users).set({ sessionVersion: sql`${schema.users.sessionVersion} + 1` }).where(eq(schema.users.id, userId)));
}

export async function findUserByEmail(tx: Tx, email: string) {
  const [row] = await tx.select(userSummary).from(schema.users).where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt))).limit(1);
  return row ?? null;
}

export async function touchLastSeen(ctx: AuthContext) {
  await withContext(ctx, (tx) => tx.update(schema.users).set({ lastSeenAt: new Date() }).where(eq(schema.users.id, ctx.userId))).catch(() => undefined);
}
