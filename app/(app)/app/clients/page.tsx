import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button-variants";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { listClientOrgs } from "@/lib/dal/orgs";
import { cn } from "@/lib/utils";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const ctx = await requirePermissionOrRedirect("app", "org.read", "/app/clients");
  const orgs = await listClientOrgs(ctx);
  return (
    <>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { label: "Clients" }]} />
      <PageHeader title="Clients" count={orgs.length} action={ctx.permissions.has("org.manage") ? <Link href="/app/admin/orgs?new=1" className={cn(buttonVariants({ variant: "primary" }))}><Plus strokeWidth={1.75} /> New client</Link> : null} />
      {orgs.length === 0 ? (
        <EmptyState icon={Building2} title="No clients yet" body="Add the first client organisation from the Admin console." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-lowest shadow-[var(--shadow-1)]">
          <table className="w-full">
            <thead className="bg-surface-container-low text-overline text-left text-on-surface-variant">
              <tr><th className="h-9 px-4 font-semibold">Client</th><th className="px-4 font-semibold">Tier</th><th className="px-4 font-semibold">Status</th><th className="px-4 text-right font-semibold">Contacts</th><th className="px-4 text-right font-semibold">Open tickets</th></tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="row-comfortable border-b border-outline-variant/40 hover:bg-surface-container-low">
                  <td className="px-4"><Link href={`/app/clients/${o.id}`} className="flex items-center gap-2 text-body-md text-primary hover:underline"><Avatar name={o.name} size={24} kind="org" /> {o.name}</Link></td>
                  <td className="px-4"><span className="text-overline rounded-full bg-surface-container px-2 py-1 text-on-surface-variant">{o.tier}</span></td>
                  <td className="px-4 text-body-sm">{o.status}</td>
                  <td className="tabular px-4 text-right text-body-sm">{o.contacts}</td>
                  <td className="tabular px-4 text-right text-body-sm">{o.openTickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
