import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { AuditFilters } from "@/components/admin/audit-filters";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { listAudit } from "@/lib/dal/audit";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Audit log" };
const PAGE = 50;

/** FR-ADM-06 — who did what, when, from where; filters; CSV export. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; actor?: string; page?: string }> }) {
  const ctx = await requirePermissionOrRedirect("app", "admin.audit", "/app/admin/audit");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { rows, count } = await listAudit(ctx, { action: sp.action || undefined, actorEmail: sp.actor || undefined, limit: PAGE, offset: (page - 1) * PAGE });
  const qs = new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), ...(sp.actor ? { actor: sp.actor } : {}) });
  return (
    <>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { href: "/app/admin", label: "Admin" }, { label: "Audit log" }]} />
      <PageHeader title="Audit log" count={count} description="Append-only. Ticket-level changes live on each ticket's timeline; this is everything else." action={<a href={`/api/admin/audit.csv?${qs}`} className="text-label text-secondary hover:underline">Export CSV</a>} />
      <AuditFilters action={sp.action ?? ""} actor={sp.actor ?? ""} />
      <div className="overflow-x-auto rounded-lg border border-outline-variant/40 bg-surface-container-lowest shadow-[var(--shadow-1)]" tabIndex={0} role="region" aria-label="Audit entries">
        <table className="w-full min-w-[800px]">
          <thead className="bg-surface-container-low text-overline text-left text-on-surface-variant"><tr><th className="h-9 px-4 font-semibold">When</th><th className="px-4 font-semibold">Actor</th><th className="px-4 font-semibold">Action</th><th className="px-4 font-semibold">Entity</th><th className="px-4 font-semibold">Change</th><th className="px-4 font-semibold">From</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-outline-variant/40 align-top" data-testid="audit-row">
                <td className="tabular whitespace-nowrap px-4 py-2 text-body-sm">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-2 text-body-sm">{r.actorEmail ?? "system"}</td>
                <td className="px-4 py-2 text-mono">{r.action}</td>
                <td className="px-4 py-2 text-body-sm text-on-surface-variant">{r.entityType}{r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ""}</td>
                <td className="px-4 py-2 text-body-sm"><Diff before={r.before} after={r.after} /></td>
                <td className="px-4 py-2 text-body-sm text-on-surface-variant">{r.ip ?? "—"}<br /><span className="line-clamp-1 max-w-48 text-[11px]">{r.userAgent ?? ""}</span></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-body-sm text-on-surface-variant">No entries match.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-body-sm text-on-surface-variant">
        <span>Page {page} of {Math.max(1, Math.ceil(count / PAGE))}</span>
        <span className="flex gap-3">
          {page > 1 ? <Link href={`?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(page - 1) })}`} className="text-secondary hover:underline">Previous</Link> : null}
          {page * PAGE < count ? <Link href={`?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(page + 1) })}`} className="text-secondary hover:underline">Next</Link> : null}
        </span>
      </div>
    </>
  );
}

function Diff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  if (!keys.length) return <span className="text-on-surface-variant">—</span>;
  return (
    <ul className="flex flex-col gap-0.5">
      {keys.slice(0, 6).map((k) => (
        <li key={k} className="truncate"><span className="text-on-surface-variant">{k}:</span> {before && k in before ? <span className="text-danger-fg line-through">{short(before[k])}</span> : null} {after && k in after ? <span className="text-success-fg">{short(after[k])}</span> : null}</li>
      ))}
    </ul>
  );
}
const short = (v: unknown) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > 60 ? `${s.slice(0, 60)}…` : s; };
