import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatTile, fmtMinutes } from "@/components/dashboards/stat-tile";
import { TicketList } from "@/components/tickets/ticket-list";
import { ContactsTable } from "@/components/admin/contacts-table";
import { OrgForm } from "@/components/admin/org-form";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { getOrg } from "@/lib/dal/orgs";
import { listPolicies } from "@/lib/dal/sla";
import { orgStats } from "@/lib/dal/stats";
import { listTickets } from "@/lib/dal/tickets";
import { listOrgContacts } from "@/lib/dal/users";
import { relativeTime } from "@/lib/utils";

/** FR-ORG-03 — org page: open tickets, SLA performance, contacts, recent activity. */
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermissionOrRedirect("app", "org.read", `/app/clients/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const org = await getOrg(ctx, id);
  if (!org || org.type !== "client") notFound();
  const [stats, contacts, open, policies] = await Promise.all([orgStats(ctx, id), listOrgContacts(ctx, id), listTickets(ctx, { orgId: id, queue: "all_open", sort: "priority", limit: 25 }), ctx.permissions.has("org.manage") ? listPolicies(ctx) : Promise.resolve([])]);
  return (
    <>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { href: "/app/clients", label: "Clients" }, { label: org.name }]} />
      <PageHeader title={org.name} description={`${org.tier} tier · ${org.timezone} · ${org.status}`} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Open tickets" value={stats.open} href={`/app/tickets?orgId=${id}&queue=all_open`} />
        <StatTile label="Created (30 d)" value={stats.created30} href={`/app/tickets?orgId=${id}&queue=all`} />
        <StatTile label="SLA met (30 d)" value={stats.slaMetPct === null ? "—" : `${stats.slaMetPct}%`} tone={stats.slaMetPct !== null && stats.slaMetPct < 90 ? "warning" : "success"} />
        <StatTile label="Hours logged (30 d)" value={fmtMinutes(stats.minutes30)} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <Card className="p-0">
            <div className="p-6 pb-2"><CardHeader eyebrow="In flight" title="Open tickets" className="mb-0" action={<Link href={`/app/tickets?orgId=${id}`} className="text-label text-secondary hover:underline">All tickets</Link>} /></div>
            <TicketList rows={open.rows} embedded compact columns={["key", "subject", "status", "priority", "assignee", "sla", "updated"]} />
          </Card>
          <Card>
            <CardHeader eyebrow="People" title="Contacts" />
            <ContactsTable orgId={id} contacts={contacts} canManage={ctx.permissions.has("contact.manage")} />
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          {ctx.permissions.has("org.manage") ? (
            <Card>
              <CardHeader eyebrow="Settings" title="Organisation" />
              <OrgForm org={{ id: org.id, name: org.name, tier: org.tier, timezone: org.timezone, slaPolicyId: org.slaPolicyId, notes: org.notes, status: org.status as "active" | "suspended", showTimeToClient: org.settings?.showTimeToClient ?? false }} policies={policies.map((p) => ({ id: p.id, name: p.name }))} />
            </Card>
          ) : org.notes ? (
            <Card><CardHeader eyebrow="Notes" title="About" /><p className="text-body-md whitespace-pre-wrap">{org.notes}</p></Card>
          ) : null}
          <Card>
            <CardHeader eyebrow="Last 15 events" title="Recent activity" />
            <ul className="divide-y divide-outline-variant/40">
              {stats.recent.map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-2 text-body-sm">
                  <Link href={`/app/tickets/${e.ticketKey}`} className="text-mono text-on-surface-variant hover:underline">{e.ticketKey}</Link>
                  <span className="min-w-0 flex-1 truncate">{e.kind.replace(/_/g, " ")}{e.actorName ? ` · ${e.actorName}` : ""}</span>
                  <span className="text-on-surface-variant">{relativeTime(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
