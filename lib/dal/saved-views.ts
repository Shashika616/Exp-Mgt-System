import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { schema, withContext } from "./db";
import type { AuthContext } from "@/lib/authz/policy";
import { notFound } from "@/lib/errors";

export async function listSavedViews(ctx: AuthContext) {
  return withContext(ctx, (tx) => tx.select().from(schema.savedViews).where(eq(schema.savedViews.userId, ctx.userId)).orderBy(asc(schema.savedViews.sortOrder), asc(schema.savedViews.name)));
}

export async function createSavedView(ctx: AuthContext, input: { name: string; query: Record<string, unknown>; columns?: string[] }) {
  return withContext(ctx, async (tx) => {
    const [row] = await tx.insert(schema.savedViews).values({ userId: ctx.userId, orgId: ctx.orgId, name: input.name, query: input.query, columns: input.columns ?? null }).returning();
    return row!;
  });
}

export async function deleteSavedView(ctx: AuthContext, id: string) {
  return withContext(ctx, async (tx) => {
    const rows = await tx.delete(schema.savedViews).where(and(eq(schema.savedViews.id, id), eq(schema.savedViews.userId, ctx.userId))).returning({ id: schema.savedViews.id });
    if (!rows.length) throw notFound();
  });
}
