import { requireUserOrRedirect } from "@/lib/auth/require";
import { listNotifications } from "@/lib/dal/notifications";
import { queueCounts } from "@/lib/dal/tickets";
import { getRunningTimer } from "@/lib/dal/work-logs";
import { touchLastSeen } from "@/lib/dal/users";
import { maybeTick } from "@/lib/jobs/run";
import { Sidebar } from "@/components/shell/sidebar";
import { navFor } from "@/components/shell/nav";
import { AppShellClient } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

/** Staff surface shell (docs/design.md §8.1). Authz: requireUserOrRedirect here; every action re-checks. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUserOrRedirect("app", "/app");
  void maybeTick();
  void touchLastSeen(ctx);
  const [counts, notifications, timer] = await Promise.all([queueCounts(ctx), listNotifications(ctx, 1), ctx.permissions.has("worklog.write") ? getRunningTimer(ctx) : Promise.resolve(null)]);
  const items = navFor(ctx.role, { review: counts.review, myWork: counts.my_work, allOpen: counts.all_open });
  return (
    <div className="min-h-dvh bg-background">
      <Sidebar items={items} />
      <AppShellClient user={{ name: ctx.fullName, email: ctx.email, role: ctx.role }} unread={notifications.unread} timer={timer ? { key: timer.key, startedAt: timer.startedAt.toISOString() } : null}>
        {children}
      </AppShellClient>
    </div>
  );
}
