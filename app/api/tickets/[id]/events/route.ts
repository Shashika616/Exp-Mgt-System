import { eq, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { schema, withContext } from "@/lib/dal/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * SSE fallback realtime (architecture.md §8): emits `change` when the ticket's version or comment count
 * changes. RLS decides visibility (a client never observes internal comments: their count excludes them).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireUser();
  } catch {
    return new Response("unauthorised", { status: 401 });
  }
  const { id } = await params;
  const fingerprint = async () => {
    const [row] = await withContext(ctx, (tx) =>
      tx
        .select({ v: schema.tickets.version, u: schema.tickets.updatedAt, c: sql<number>`(select count(*) from comments c where c.ticket_id = ${schema.tickets.id} and c.deleted_at is null)::int`, w: sql<number>`(select count(*) from work_logs w where w.ticket_id = ${schema.tickets.id})::int` })
        .from(schema.tickets)
        .where(eq(schema.tickets.id, id))
        .limit(1),
    );
    return row ? `${row.v}:${row.u.getTime()}:${row.c}:${row.w}` : null;
  };
  let last = await fingerprint();
  if (last === null) return new Response("not found", { status: 404 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`event: ready\ndata: ok\n\n`));
      const started = Date.now();
      const loop = async () => {
        while (Date.now() - started < (maxDuration - 5) * 1000) {
          if (req.signal.aborted) break;
          await new Promise((r) => setTimeout(r, 3000));
          try {
            const now = await fingerprint();
            if (now && now !== last) {
              last = now;
              controller.enqueue(encoder.encode(`event: change\ndata: ${now}\n\n`));
            } else controller.enqueue(encoder.encode(`: keepalive\n\n`));
          } catch {
            break;
          }
        }
        controller.close();
      };
      void loop();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
