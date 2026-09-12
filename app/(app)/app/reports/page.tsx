import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { LineChart } from "@/components/charts/line-chart";
import { StatTile, fmtMinutes } from "@/components/dashboards/stat-tile";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { adminDashboard, dailyStats } from "@/lib/dal/stats";

export const metadata = { title: "Reports" };

/** Reports (P0 subset of FR-RP-05): volume trend, SLA attainment per client, developer load. */
export default async function ReportsPage() {
  const ctx = await requirePermissionOrRedirect("app", "report.view", "/app/reports");
  const [d, daily] = await Promise.all([adminDashboard(ctx), dailyStats(ctx, 30)]);
  const byDay = new Map<string, { fr: number; frb: number; res: number; resb: number }>();
  for (const r of daily) {
    const k = String(r.day);
    const cur = byDay.get(k) ?? { fr: 0, frb: 0, res: 0, resb: 0 };
    byDay.set(k, { fr: cur.fr + r.firstResponseMet, frb: cur.frb + r.firstResponseBreached, res: cur.res + r.resolutionMet, resb: cur.resb + r.resolutionBreached });
  }
  const labels = d.trend.map((x) => x.day);
  return (
    <>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { label: "Reports" }]} />
      <PageHeader title="Reports" description="Last 30 days. Daily aggregates come from the nightly stats job; today is computed live." />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Open" value={d.tiles.open} />
        <StatTile label="Overdue (open, breached)" value={d.tiles.breachedOpen} tone={d.tiles.breachedOpen ? "danger" : undefined} />
        <StatTile label="Avg first response (30 d)" value={fmtMinutes(d.tiles.avgFirstResponse30)} />
        <StatTile label="Avg resolution (30 d)" value={fmtMinutes(d.tiles.avgResolution30)} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card><CardHeader eyebrow="Volume" title="Created vs resolved" /><LineChart labels={labels} series={[{ name: "Created", color: "#1470e8", values: d.trend.map((x) => x.created) }, { name: "Resolved", color: "#146b3f", values: d.trend.map((x) => x.resolved) }]} ariaLabel="Created vs resolved per day" /></Card>
        <Card><CardHeader eyebrow="SLA" title="Targets met vs breached (from nightly stats)" /><LineChart labels={labels} series={[{ name: "Met", color: "#146b3f", values: labels.map((l) => (byDay.get(l)?.fr ?? 0) + (byDay.get(l)?.res ?? 0)) }, { name: "Breached", color: "#ba1a1a", values: labels.map((l) => (byDay.get(l)?.frb ?? 0) + (byDay.get(l)?.resb ?? 0)) }]} ariaLabel="SLA targets met and breached per day" /></Card>
        <Card>
          <CardHeader eyebrow="Per client" title="Volume & SLA attainment" />
          <table className="w-full"><thead className="text-overline text-left text-on-surface-variant"><tr><th className="pb-2 font-semibold">Client</th><th className="pb-2 text-right font-semibold">Open</th><th className="pb-2 text-right font-semibold">SLA met (30 d)</th></tr></thead>
            <tbody className="divide-y divide-outline-variant/40">{d.slaByClient.map((c) => (<tr key={c.orgId} className="h-10"><td className="text-body-md">{c.orgName}</td><td className="tabular text-right">{c.open}</td><td className="tabular text-right">{c.total ? `${Math.round((c.met / c.total) * 100)}%` : "-"}</td></tr>))}</tbody></table>
        </Card>
        <Card>
          <CardHeader eyebrow="Per developer" title="Load & hours this week" />
          <table className="w-full"><thead className="text-overline text-left text-on-surface-variant"><tr><th className="pb-2 font-semibold">Developer</th><th className="pb-2 text-right font-semibold">Assigned</th><th className="pb-2 text-right font-semibold">Blocked</th><th className="pb-2 text-right font-semibold">Hours</th></tr></thead>
            <tbody className="divide-y divide-outline-variant/40">{d.loadBoard.map((x) => (<tr key={x.id} className="h-10"><td className="text-body-md">{x.name}</td><td className="tabular text-right">{x.assigned}</td><td className="tabular text-right">{x.blocked}</td><td className="tabular text-right">{(x.hoursWeek / 60).toFixed(1)}</td></tr>))}</tbody></table>
        </Card>
      </div>
    </>
  );
}
