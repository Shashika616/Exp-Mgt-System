import Link from "next/link";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { OrgForm } from "@/components/admin/org-form";
import { Avatar } from "@/components/ui/avatar";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { listClientOrgs } from "@/lib/dal/orgs";
import { listPolicies } from "@/lib/dal/sla";

export const metadata = { title: "Client organisations" };

/** FR-ORG-01 */
export default async function OrgsAdminPage() {
  const ctx = await requirePermissionOrRedirect("app", "org.manage", "/app/admin/orgs");
  const [orgs, policies] = await Promise.all([listClientOrgs(ctx), listPolicies(ctx)]);
  return (
    <>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { href: "/app/admin", label: "Admin" }, { label: "Client organisations" }]} />
      <PageHeader title="Client organisations" count={orgs.length} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-lowest shadow-[var(--shadow-1)]">
          <table className="w-full">
            <thead className="bg-surface-container-low text-overline text-left text-on-surface-variant"><tr><th className="h-9 px-4 font-semibold">Client</th><th className="px-4 font-semibold">Tier</th><th className="px-4 font-semibold">Status</th><th className="px-4 text-right font-semibold">Contacts</th><th className="px-4 text-right font-semibold">Open</th></tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="row-comfortable border-b border-outline-variant/40 hover:bg-surface-container-low">
                  <td className="px-4"><Link href={`/app/clients/${o.id}`} className="flex items-center gap-2 text-body-md hover:underline"><Avatar name={o.name} size={24} kind="org" />{o.name}</Link></td>
                  <td className="px-4 text-body-sm">{o.tier}</td>
                  <td className="px-4 text-body-sm">{o.status}</td>
                  <td className="tabular px-4 text-right text-body-sm">{o.contacts}</td>
                  <td className="tabular px-4 text-right text-body-sm">{o.openTickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Card>
          <CardHeader eyebrow="New" title="Add a client" />
          <OrgForm policies={policies.map((p) => ({ id: p.id, name: p.name }))} />
        </Card>
      </div>
    </>
  );
}
