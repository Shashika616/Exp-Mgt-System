import "server-only";
import { asc, eq } from "drizzle-orm";
import { schema, type Tx } from "./db";
import type { AuthContext } from "@/lib/authz/policy";
import type { Visibility } from "@/lib/domain/types";

export type EventInput = {
  ticketId: string;
  orgId: string;
  kind: string;
  data?: Record<string, unknown>;
  /** public = the client may see it on the portal timeline; internal = staff only */
  visibility?: Visibility;
};

/** Every ticket mutation emits one of these inside the same transaction (requirements.md §5.4 rule 8, FR-AU-01). */
export async function emitEvent(tx: Tx, ctx: AuthContext, e: EventInput): Promise<void> {
  await tx.insert(schema.ticketEvents).values({
    ticketId: e.ticketId,
    orgId: e.orgId,
    actorId: ctx.role === "system" ? null : ctx.userId,
    kind: e.kind,
    visibility: e.visibility ?? "internal",
    data: e.data ?? {},
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent?.slice(0, 500) ?? null,
  });
}

export async function listEvents(tx: Tx, ticketId: string) {
  return tx
    .select({
      id: schema.ticketEvents.id,
      kind: schema.ticketEvents.kind,
      visibility: schema.ticketEvents.visibility,
      data: schema.ticketEvents.data,
      createdAt: schema.ticketEvents.createdAt,
      actorId: schema.ticketEvents.actorId,
      actorName: schema.users.fullName,
      actorRole: schema.users.roleId,
    })
    .from(schema.ticketEvents)
    .leftJoin(schema.users, eq(schema.users.id, schema.ticketEvents.actorId))
    .where(eq(schema.ticketEvents.ticketId, ticketId))
    .orderBy(asc(schema.ticketEvents.createdAt), asc(schema.ticketEvents.id));
}

export type EventRow = Awaited<ReturnType<typeof listEvents>>[number];
