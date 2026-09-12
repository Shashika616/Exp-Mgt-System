import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { SlaAdmin } from "@/components/admin/sla-admin";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { listPolicies } from "@/lib/dal/sla";
import type { BusinessCalendar } from "@/lib/domain/sla-calendar";
import type { SlaTargets } from "@/lib/domain/sla-timers";

export const metadata = { title: "SLA policies" };

/** FR-ADM-03 */
export default async function SlaPage() {
  const ctx = await requirePermissionOrRedirect("app", "admin.sla", "/app/admin/sla");
  const policies = await listPolicies(ctx);
  return (
    <>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { href: "/app/admin", label: "Admin" }, { label: "SLA policies" }]} />
      <PageHeader title="SLA policies" description="Targets per priority, business-hours calendar and holidays. P1/P2 run 24×7 by default (the website promises 24/7 incident response)." />
      <SlaAdmin policies={policies.map((p) => ({ id: p.id, name: p.name, calendar: p.calendar as BusinessCalendar, targets: p.targets as SlaTargets, isDefault: p.isDefault }))} />
    </>
  );
}
