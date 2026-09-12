import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { schema, withContext } from "@/lib/dal/db";

export const dynamic = "force-dynamic";

/**
 * Portable realtime fallback (architecture.md §8): a cheap fingerprint the detail page polls while visible.
 * RLS decides visibility — a client's fingerprint never counts internal comments or work logs.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [row] = await withContext(ctx, (tx) =>
    tx
      .select({
        v: schema.tickets.version,
        u: schema.tickets.updatedAt,
        c: sql<number>`(select count(*) from comments c where c.ticket_id = ${schema.tickets.id} and c.deleted_at is null)::int`,
        w: sql<number>`(select count(*) from work_logs w where w.ticket_id = ${schema.tickets.id})::int`,
      })
      .from(schema.tickets)
      .where(eq(schema.tickets.id, id))
      .limit(1),
  );
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ fingerprint: `${row.v}:${row.u.getTime()}:${row.c}:${row.w}` }, { headers: { "Cache-Control": "no-store" } });
}
