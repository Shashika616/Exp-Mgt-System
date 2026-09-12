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
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        if (closed || req.signal.aborted) return false;
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch {
          closed = true;
          return false;
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };
      // Client went away: stop the loop; the consumer already cancelled the stream, no close() needed.
      req.signal.addEventListener("abort", () => (closed = true), { once: true });
      send(`event: ready\ndata: ok\n\n`);
      const started = Date.now();
      const loop = async () => {
        while (!closed && !req.signal.aborted && Date.now() - started < (maxDuration - 5) * 1000) {
          await new Promise((r) => setTimeout(r, 3000));
          try {
            const now = await fingerprint();
            if (now && now !== last) {
              last = now;
              if (!send(`event: change\ndata: ${now}\n\n`)) break;
            } else if (!send(`: keepalive\n\n`)) break;
          } catch {
            break;
          }
        }
        finish();
      };
      void loop();
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
