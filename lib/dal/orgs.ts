import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { schema, withContext, type Tx } from "./db";
import type { AuthContext } from "@/lib/authz/policy";
import { AppError, notFound } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import { auditInTx } from "./audit";
import type { DeveloperPublicReply } from "@/lib/domain/types";

export type OrgSettings = { developersCanSelfAssign: boolean; developerPublicReply: DeveloperPublicReply; showTimeToClient: boolean };

export async function getStaffOrgId(tx: Tx): Promise<string> {
  const [row] = await tx.select({ id: schema.organisations.id }).from(schema.organisations).where(eq(schema.organisations.type, "staff")).limit(1);
  if (!row) throw new AppError("internal", "staff organisation missing — run pnpm db:seed");
  return row.id;
}

/** Global policies live on the staff org's settings row (requirements.md §5.4 rule 4). */
export async function globalSettings(tx: Tx): Promise<OrgSettings> {
  const staffId = await getStaffOrgId(tx);
  const [row] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.orgId, staffId)).limit(1);
  return { developersCanSelfAssign: row?.developersCanSelfAssign ?? false, developerPublicReply: row?.developerPublicReply ?? "always", showTimeToClient: row?.showTimeToClient ?? false };
}

export async function orgSettingsFor(tx: Tx, orgId: string): Promise<OrgSettings> {
  const [row] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.orgId, orgId)).limit(1);
  const g = await globalSettings(tx);
  return { developersCanSelfAssign: g.developersCanSelfAssign, developerPublicReply: g.developerPublicReply, showTimeToClient: row?.showTimeToClient ?? g.showTimeToClient };
}

export async function listClientOrgs(ctx: AuthContext) {
  return withContext(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: schema.organisations.id,
        name: schema.organisations.name,
        slug: schema.organisations.slug,
        tier: schema.organisations.tier,
        timezone: schema.organisations.timezone,
        status: schema.organisations.status,
        slaPolicyId: schema.organisations.slaPolicyId,
        createdAt: schema.organisations.createdAt,
        openTickets: sql<number>`(select count(*)::int from tickets t where t.org_id = ${schema.organisations.id} and t.status not in ('closed','cancelled') and t.deleted_at is null)`,
        contacts: sql<number>`(select count(*)::int from users u where u.org_id = ${schema.organisations.id} and u.deleted_at is null)`,
      })
      .from(schema.organisations)
      .where(and(eq(schema.organisations.type, "client"), isNull(schema.organisations.deletedAt)))
      .orderBy(asc(schema.organisations.name));
    return rows;
  });
}

export async function getOrg(ctx: AuthContext, id: string) {
  return withContext(ctx, async (tx) => {
    const [row] = await tx.select().from(schema.organisations).where(and(eq(schema.organisations.id, id), isNull(schema.organisations.deletedAt))).limit(1);
    if (!row) return null;
    const [settings] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.orgId, id)).limit(1);
    return { ...row, settings: settings ?? null };
  });
}

export type OrgInput = {
  name: string;
  tier: "standard" | "priority" | "enterprise";
  timezone: string;
  slaPolicyId?: string | null;
  notes?: string | null;
  status: "active" | "suspended";
  showTimeToClient?: boolean;
};

export async function createOrg(ctx: AuthContext, input: OrgInput) {
  return withContext(ctx, async (tx) => {
    let slug = slugify(input.name) || "client";
    const [dup] = await tx.select({ id: schema.organisations.id }).from(schema.organisations).where(eq(schema.organisations.slug, slug)).limit(1);
    if (dup) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const [row] = await tx
      .insert(schema.organisations)
      .values({ type: "client", name: input.name, slug, tier: input.tier, timezone: input.timezone, slaPolicyId: input.slaPolicyId ?? null, notes: input.notes ?? null, status: input.status })
      .returning();
    await tx.insert(schema.orgSettings).values({ orgId: row!.id, showTimeToClient: input.showTimeToClient ?? false }).onConflictDoNothing();
    await auditInTx(tx, ctx, { action: "org.created", entityType: "organisation", entityId: row!.id, orgId: row!.id, after: input as Record<string, unknown> });
    return row!;
  });
}

export async function updateOrg(ctx: AuthContext, id: string, input: Partial<OrgInput>) {
  return withContext(ctx, async (tx) => {
    const [before] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, id)).limit(1);
    if (!before || before.type !== "client") throw notFound();
    const { showTimeToClient, ...orgPatch } = input;
    const [row] = await tx.update(schema.organisations).set(orgPatch).where(eq(schema.organisations.id, id)).returning();
    if (showTimeToClient !== undefined) {
      await tx.insert(schema.orgSettings).values({ orgId: id, showTimeToClient }).onConflictDoUpdate({ target: schema.orgSettings.orgId, set: { showTimeToClient } });
    }
    await auditInTx(tx, ctx, {
      action: "org.updated",
      entityType: "organisation",
      entityId: id,
      orgId: id,
      before: { name: before.name, tier: before.tier, status: before.status, slaPolicyId: before.slaPolicyId },
      after: input as Record<string, unknown>,
    });
    return row!;
  });
}

export async function updateGlobalSettings(ctx: AuthContext, patch: Partial<OrgSettings>) {
  return withContext(ctx, async (tx) => {
    const staffId = await getStaffOrgId(tx);
    const before = await globalSettings(tx);
    await tx.insert(schema.orgSettings).values({ orgId: staffId, ...patch }).onConflictDoUpdate({ target: schema.orgSettings.orgId, set: patch });
    await auditInTx(tx, ctx, { action: "settings.updated", entityType: "settings", entityId: "global", orgId: staffId, before: { ...before }, after: patch as Record<string, unknown> });
  });
}

export async function getGlobalConfig(ctx: AuthContext) {
  return withContext(ctx, (tx) => globalSettings(tx));
}
