import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { getGlobalConfig } from "@/lib/dal/orgs";

export const metadata = { title: "Settings" };

/** FR-ADM-05 (workflow policies). Auto-close was removed by owner decision - closing is always a human action. */
export default async function SettingsPage() {
  const ctx = await requirePermissionOrRedirect("app", "admin.settings", "/app/admin/settings");
  const cfg = await getGlobalConfig(ctx);
  return (
    <>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { href: "/app/admin", label: "Admin" }, { label: "Settings" }]} />
      <PageHeader title="Settings" description="Global workflow policies. Every change is written to the audit log." />
      <SettingsForm value={cfg} />
    </>
  );
}
