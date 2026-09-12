"use server";
import { z } from "zod";
import { action } from "./_helpers";
import { listNotifications, markNotificationsRead } from "@/lib/dal/notifications";
import { uuid } from "@/lib/schemas/common";
import { searchTickets } from "@/lib/dal/tickets";
import { listClientOrgs } from "@/lib/dal/orgs";

export const fetchNotifications = action(z.object({}).strict(), "notification.read", async (ctx) => {
  const { rows, unread } = await listNotifications(ctx, 20);
  return { unread, rows: rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, href: r.href, readAt: r.readAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() })) };
});

export const markRead = action(z.object({ ids: z.union([z.array(uuid).max(100), z.literal("all")]) }).strict(), "notification.read", async (ctx, input) => {
  await markNotificationsRead(ctx, input.ids);
  return { ok: true };
});

/** ⌘K search (FR-AG-09): tickets + clients. */
export const globalSearch = action(z.object({ q: z.string().max(200) }).strict(), "search.global", async (ctx, input) => {
  const q = input.q.trim();
  if (!q) return { tickets: [], orgs: [] };
  const [tickets, orgs] = await Promise.all([searchTickets(ctx, q, 8), ctx.permissions.has("org.read") ? listClientOrgs(ctx) : Promise.resolve([])]);
  return {
    tickets,
    orgs: orgs.filter((o) => o.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5).map((o) => ({ id: o.id, name: o.name })),
  };
});
