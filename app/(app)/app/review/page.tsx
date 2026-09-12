import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { PriorityBadge } from "@/components/tickets/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { reviewQueue } from "@/lib/dal/submissions";
import { formatMinutes, relativeTime } from "@/lib/utils";
import { redirect } from "next/navigation";

export const metadata = { title: "Review queue" };

/** FR-DEV-07 — tickets in review, oldest first, time in review. Opening one lands on the ticket with the review sheet. */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ ticket?: string }> }) {
  const ctx = await requirePermissionOrRedirect("app", "ticket.review", "/app/review");
  const { ticket } = await searchParams;
  if (ticket && /^EXP-\d+$/.test(ticket)) redirect(`/app/tickets/${ticket}?review=1`);
  const rows = await reviewQueue(ctx);
  return (
    <>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { label: "Review" }]} />
      <PageHeader title="Review queue" count={rows.length} description="Developer submissions waiting for your decision — oldest first." />
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing to review" body="When a developer submits their work it appears here with their findings, fix and proposed reply." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-lowest shadow-[var(--shadow-1)]">
          <table className="w-full">
            <thead className="bg-surface-container-low text-overline text-left text-on-surface-variant">
              <tr>
                <th className="h-9 px-4 font-semibold">Key</th>
                <th className="px-4 font-semibold">Subject</th>
                <th className="px-4 font-semibold">Client</th>
                <th className="px-4 font-semibold">Developer</th>
                <th className="px-4 font-semibold">Priority</th>
                <th className="px-4 text-right font-semibold">Logged</th>
                <th className="px-4 text-right font-semibold">In review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="row-comfortable border-b border-outline-variant/40 hover:bg-surface-container-low">
                  <td className="px-4"><Link href={`/app/tickets/${r.key}?review=1`} className="text-mono text-primary hover:underline" data-testid={`review-${r.key}`}>{r.key}</Link></td>
                  <td className="px-4"><Link href={`/app/tickets/${r.key}?review=1`} className="text-body-md hover:underline">{r.subject}</Link></td>
                  <td className="px-4 text-body-sm text-on-surface-variant">{r.orgName}</td>
                  <td className="px-4 text-body-sm">{r.developerName}</td>
                  <td className="px-4"><PriorityBadge priority={r.priority} short /></td>
                  <td className="tabular px-4 text-right text-body-sm">{formatMinutes(r.timeSpentMinutes)}</td>
                  <td className="tabular px-4 text-right text-body-sm text-on-surface-variant" title={r.submittedAt?.toISOString()}>{r.submittedAt ? relativeTime(r.submittedAt).replace(" ago", "") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
