import Link from "next/link";
import { ArrowUpRight, ClipboardCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { LineChart } from "@/components/charts/line-chart";
import { Legend, StackedBar } from "@/components/charts/stacked-bar";
import { PriorityBadge } from "@/components/tickets/badges";
import { StatTile, fmtMinutes } from "./stat-tile";
import type { AdminDashboard as Data } from "@/lib/dal/stats";
import type { reviewQueue } from "@/lib/dal/submissions";
import { formatMinutes, relativeTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

const WS = [
  { key: "investigating", label: "Investigating", color: "#1470e8" },
  { key: "fixInProgress", label: "Fix in progress", color: "#5b3fd6" },
  { key: "fixReady", label: "Fix ready", color: "#146b3f" },
  { key: "needsInfo", label: "Needs info", color: "#9a5b00" },
  { key: "blocked", label: "Blocked", color: "#ba1a1a" },
] as const;

/** FR-RP-01 — run the desk. Every tile links to the filtered list. */
export function AdminDashboard({ data, review }: { data: Data; review: Awaited<ReturnType<typeof reviewQueue>> }) {
  const t = data.tiles;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <StatTile label="Open" value={t.open} href="/app/tickets?queue=all_open" />
        <StatTile label="Unassigned" value={t.unassigned} href="/app/tickets?queue=unassigned" tone={t.unassigned > 0 ? "warning" : undefined} />
        <StatTile label="Awaiting review" value={t.awaitingReview} href="/app/review" tone={t.awaitingReview > 0 ? "info" : undefined} />
        <StatTile label="At risk" value={t.atRisk} href="/app/tickets?queue=at_risk" tone={t.atRisk > 0 ? "warning" : undefined} />
        <StatTile label="Breached today" value={t.breachedToday} href="/app/tickets?sla=breached" tone={t.breachedToday > 0 ? "danger" : undefined} hint={t.breachedOpen ? `${t.breachedOpen} open` : undefined} />
        <StatTile label="Avg first response" value={fmtMinutes(t.avgFirstResponse7)} hint={`30d ${fmtMinutes(t.avgFirstResponse30)}`} />
        <StatTile label="Avg resolution" value={fmtMinutes(t.avgResolution7)} hint={`30d ${fmtMinutes(t.avgResolution30)}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader eyebrow="Last 30 days" title="Created vs resolved" />
          <LineChart
            labels={data.trend.map((d) => d.day)}
            series={[
              { name: "Created", color: "#1470e8", values: data.trend.map((d) => d.created) },
              { name: "Resolved", color: "#146b3f", values: data.trend.map((d) => d.resolved) },
            ]}
            ariaLabel="Tickets created and resolved per day, last 30 days"
          />
        </Card>
        <Card>
          <CardHeader eyebrow="Oldest first" title="Review queue" action={<Link href="/app/review" className="text-label flex items-center gap-1 text-secondary hover:underline">All <ArrowUpRight className="size-4" /></Link>} />
          {review.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Nothing awaiting review" body="Submissions from developers will appear here, oldest first." className="py-8" />
          ) : (
            <ul className="divide-y divide-outline-variant/40">
              {review.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link href={`/app/review?ticket=${r.key}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 py-2.5 hover:bg-surface-container-low">
                    <span className="text-mono text-on-surface-variant">{r.key}</span>
                    <span className="min-w-0 truncate text-body-md">{r.subject}</span>
                    <PriorityBadge priority={r.priority} short />
                    <span className="col-span-3 text-body-sm text-on-surface-variant">{r.developerName} · {formatMinutes(r.minutesInReview)} in review</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader eyebrow="Developers" title="Load board" action={<Legend items={WS.map((w) => ({ label: w.label, color: w.color }))} />} />
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-overline text-left text-on-surface-variant">
                <th className="pb-2 font-semibold">Developer</th>
                <th className="pb-2 text-right font-semibold">Assigned</th>
                <th className="w-[40%] pb-2 font-semibold">By work state</th>
                <th className="pb-2 text-right font-semibold">Blocked</th>
                <th className="pb-2 text-right font-semibold">In review</th>
                <th className="pb-2 text-right font-semibold">Hours this week</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {data.loadBoard.map((d) => (
                <tr key={d.id} className="h-12">
                  <td className="text-body-md text-primary">
                    <Link href={`/app/tickets?assignee=${d.id}&queue=all_open`} className="hover:text-secondary hover:underline">
                      {d.name}
                    </Link>
                  </td>
                  <td className="tabular text-right font-heading font-medium">{d.assigned}</td>
                  <td className="pr-4">
                    <StackedBar ariaLabel={`${d.name} work states`} segments={WS.map((w) => ({ key: w.key, label: w.label, color: w.color, value: d[w.key] }))} />
                  </td>
                  <td className={`tabular text-right font-heading font-medium ${d.blocked ? "text-danger-fg" : ""}`}>{d.blocked}</td>
                  <td className="tabular text-right font-heading font-medium">{d.inReview}</td>
                  <td className="tabular text-right font-heading font-medium">{(d.hoursWeek / 60).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Last 30 days" title="SLA attainment per client" />
          <ul className="divide-y divide-outline-variant/40">
            {data.slaByClient.map((c) => {
              const pct = c.total ? Math.round((c.met / c.total) * 100) : null;
              return (
                <li key={c.orgId} className="flex items-center gap-3 py-2.5">
                  <Link href={`/app/clients/${c.orgId}`} className="min-w-0 flex-1 truncate text-body-md hover:text-secondary hover:underline">
                    {c.orgName}
                  </Link>
                  <span className="text-body-sm text-on-surface-variant">{c.open} open</span>
                  <div className="h-2 w-28 overflow-hidden rounded-sm bg-surface-container-high" role="img" aria-label={`${pct ?? 0}% of SLAs met`}>
                    <div className={`h-full rounded-sm ${pct !== null && pct < 80 ? "bg-danger-fg" : pct !== null && pct < 95 ? "bg-warning-fg" : "bg-success-fg"}`} style={{ width: `${pct ?? 0}%` }} />
                  </div>
                  <span className="tabular w-12 text-right font-heading text-[13px] font-semibold">{pct === null ? "—" : `${pct}%`}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <CardHeader eyebrow="Open tickets" title="Recent escalations" />
          {data.escalations.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No escalated tickets right now.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/40">
              {data.escalations.map((e) => (
                <li key={e.id}>
                  <Link href={`/app/tickets/${e.key}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-container-low">
                    <span className="text-mono w-20 shrink-0 text-on-surface-variant">{e.key}</span>
                    <span className="min-w-0 flex-1 truncate text-body-md">{e.subject}</span>
                    <span className="text-body-sm hidden text-on-surface-variant sm:inline">{e.orgName}</span>
                    <span className="text-overline rounded-full bg-danger-bg px-2 py-1 text-danger-fg">L{e.escalationLevel}</span>
                    <span className="text-body-sm w-14 text-right text-on-surface-variant">{e.escalatedAt ? relativeTime(e.escalatedAt) : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
