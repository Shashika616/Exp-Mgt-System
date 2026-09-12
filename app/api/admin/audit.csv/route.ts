import { requireUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/authz/policy";
import { audit, listAudit } from "@/lib/dal/audit";

export const dynamic = "force-dynamic";

/** CSV export of the audit log (FR-ADM-06). Cells starting with = + - @ are prefixed to block formula injection. */
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await requireUser();
    requirePermission(ctx, "admin.audit");
  } catch {
    return new Response("unauthorised", { status: 401 });
  }
  const url = new URL(req.url);
  const { rows } = await listAudit(ctx, { action: url.searchParams.get("action") || undefined, actorEmail: url.searchParams.get("actor") || undefined, limit: 100 });
  await audit(ctx, { action: "audit.exported", entityType: "audit_log", after: { rows: rows.length } });
  const esc = (v: unknown) => {
    let s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = ["when,actor,action,entity_type,entity_id,before,after,ip", ...rows.map((r) => [r.createdAt.toISOString(), r.actorEmail, r.action, r.entityType, r.entityId, r.before, r.after, r.ip].map(esc).join(","))];
  return new Response(lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="audit-log.csv"', "Cache-Control": "no-store" } });
}
