import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { AdminDashboard } from "@/components/dashboards/admin";
import { AgentDashboard } from "@/components/dashboards/agent";
import { DeveloperDashboard } from "@/components/dashboards/developer";
import { requireUserOrRedirect } from "@/lib/auth/require";
import { adminDashboard, agentDashboard, developerDashboard } from "@/lib/dal/stats";
import { reviewQueue } from "@/lib/dal/submissions";
import { listTickets, queueCounts } from "@/lib/dal/tickets";
import { getRunningTimer, myTimeSummary } from "@/lib/dal/work-logs";
import { firstName } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

/** Every party lands on a dashboard built for their job (requirements.md §7.8). */
export default async function DashboardPage() {
  const ctx = await requireUserOrRedirect("app", "/app");
  const greeting = `Good ${new Date().getUTCHours() + 5.5 < 12 ? "morning" : new Date().getUTCHours() + 5.5 < 17 ? "afternoon" : "evening"}, ${firstName(ctx.fullName)}`;
  if (ctx.role === "developer") {
    const [data, time, timer] = await Promise.all([developerDashboard(ctx), myTimeSummary(ctx), getRunningTimer(ctx)]);
    return (
      <>
        <Breadcrumbs items={[{ label: "Dashboard" }]} />
        <PageHeader title={greeting} description="What needs you next, by work state." />
        <DeveloperDashboard data={data} time={time} timer={timer ? { key: timer.key, startedAt: timer.startedAt.toISOString() } : null} />
      </>
    );
  }
  if (ctx.role === "lead" || ctx.role === "admin") {
    const [data, review] = await Promise.all([adminDashboard(ctx), reviewQueue(ctx, 8)]);
    return (
      <>
        <Breadcrumbs items={[{ label: "Dashboard" }]} />
        <PageHeader title={greeting} description="The desk at a glance, open work, reviews waiting, SLA health and developer load." />
        <AdminDashboard data={data} review={review} />
      </>
    );
  }
  const [data, counts, unassigned, mine] = await Promise.all([agentDashboard(ctx), queueCounts(ctx), listTickets(ctx, { queue: "unassigned", sort: "priority", limit: 8 }), listTickets(ctx, { queue: "mine", sort: "due", limit: 8 })]);
  return (
    <>
      <Breadcrumbs items={[{ label: "Dashboard" }]} />
      <PageHeader title={greeting} description="Keep the queue moving." />
      <AgentDashboard data={data} counts={counts} unassigned={unassigned.rows} mine={mine.rows} />
    </>
  );
}
