import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { schema, withContext } from "./db";
import type { AuthContext } from "@/lib/authz/policy";
import { AppError } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import { auditInTx } from "./audit";

export async function listCategories(ctx: AuthContext, includeInactive = false) {
  return withContext(ctx, (tx) =>
    tx
      .select()
      .from(schema.categories)
      .where(and(isNull(schema.categories.deletedAt), includeInactive ? undefined : eq(schema.categories.active, true)))
      .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name)),
  );
}

export async function createCategory(ctx: AuthContext, input: { name: string; parentId?: string | null; description?: string | null }) {
  return withContext(ctx, async (tx) => {
    const slug = slugify(input.name);
    const [dup] = await tx.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.slug, slug)).limit(1);
    if (dup) throw new AppError("conflict", "A category with this name already exists.");
    const [row] = await tx.insert(schema.categories).values({ name: input.name, slug, parentId: input.parentId ?? null, description: input.description ?? null }).returning();
    await auditInTx(tx, ctx, { action: "category.created", entityType: "category", entityId: row!.id, after: { name: input.name, parentId: input.parentId ?? null } });
    return row!;
  });
}

export async function updateCategory(ctx: AuthContext, id: string, patch: { name?: string; description?: string | null; active?: boolean; sortOrder?: number }) {
  return withContext(ctx, async (tx) => {
    const [before] = await tx.select().from(schema.categories).where(eq(schema.categories.id, id)).limit(1);
    if (!before) throw new AppError("not_found");
    const [row] = await tx.update(schema.categories).set(patch).where(eq(schema.categories.id, id)).returning();
    await auditInTx(tx, ctx, { action: "category.updated", entityType: "category", entityId: id, before: { name: before.name, active: before.active }, after: patch });
    return row!;
  });
}

export async function listCanned(ctx: AuthContext) {
  return withContext(ctx, (tx) => tx.select().from(schema.cannedResponses).where(isNull(schema.cannedResponses.deletedAt)).orderBy(asc(schema.cannedResponses.title)));
}

export async function upsertCanned(ctx: AuthContext, input: { id?: string; title: string; shortcut?: string | null; body: string }) {
  return withContext(ctx, async (tx) => {
    const { getStaffOrgId } = await import("./orgs");
    const orgId = await getStaffOrgId(tx);
    if (input.id) {
      const [row] = await tx.update(schema.cannedResponses).set({ title: input.title, shortcut: input.shortcut ?? null, body: input.body }).where(eq(schema.cannedResponses.id, input.id)).returning();
      await auditInTx(tx, ctx, { action: "canned.updated", entityType: "canned_response", entityId: input.id, after: { title: input.title } });
      return row!;
    }
    const [row] = await tx.insert(schema.cannedResponses).values({ orgId, title: input.title, shortcut: input.shortcut ?? null, body: input.body, createdBy: ctx.userId }).returning();
    await auditInTx(tx, ctx, { action: "canned.created", entityType: "canned_response", entityId: row!.id, after: { title: input.title } });
    return row!;
  });
}

export async function deleteCanned(ctx: AuthContext, id: string) {
  return withContext(ctx, async (tx) => {
    await tx.update(schema.cannedResponses).set({ deletedAt: new Date() }).where(eq(schema.cannedResponses.id, id));
    await auditInTx(tx, ctx, { action: "canned.deleted", entityType: "canned_response", entityId: id });
  });
}

export async function listTemplates(ctx: AuthContext) {
  return withContext(ctx, (tx) => tx.select().from(schema.emailTemplates).orderBy(asc(schema.emailTemplates.name)));
}

export async function getTemplate(ctx: AuthContext, id: string) {
  return withContext(ctx, async (tx) => {
    const [row] = await tx.select().from(schema.emailTemplates).where(eq(schema.emailTemplates.id, id)).limit(1);
    return row ?? null;
  });
}

export async function updateTemplate(ctx: AuthContext, id: string, patch: { subject: string; body: string }) {
  return withContext(ctx, async (tx) => {
    const [before] = await tx.select().from(schema.emailTemplates).where(eq(schema.emailTemplates.id, id)).limit(1);
    if (!before) throw new AppError("not_found");
    const [row] = await tx.update(schema.emailTemplates).set({ ...patch, updatedBy: ctx.userId }).where(eq(schema.emailTemplates.id, id)).returning();
    await auditInTx(tx, ctx, { action: "template.updated", entityType: "email_template", entityId: id, before: { subject: before.subject, body: before.body }, after: patch });
    return row!;
  });
}
