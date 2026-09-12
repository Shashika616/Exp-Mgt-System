import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { RequestCard } from "@/components/portal/request-card";
import { PortalFilters } from "@/components/portal/portal-filters";
import { StatTile, fmtMinutes } from "@/components/dashboards/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button-variants";
import { requireUserOrRedirect } from "@/lib/auth/require";
import { listMyRequests, orgMonthlySummary } from "@/lib/dal/portal/tickets";
import { listOrgContacts } from "@/lib/dal/users";
import { cn, firstName } from "@/lib/utils";

export const metadata = { title: "My requests" };

/** FR-RP-04 + FR-CP-03/04: client dashboard — needs-your-reply, open with target dates, recently resolved, monthly summary. */
export default async function PortalHome({ searchParams }: { searchParams: Promise<{ scope?: string; q?: string; contact?: string }> }) {
  const ctx = await requireUserOrRedirect("portal", "/portal");
  const sp = await searchParams;
  const scope = sp.scope === "resolved" || sp.scope === "all" ? sp.scope : "open";
  const isAdmin = ctx.role === "client_admin";
  const [rows, summary, contacts] = await Promise.all([listMyRequests(ctx, { scope: scope === "open" ? "open" : scope === "resolved" ? "resolved" : "all", q: sp.q, requesterId: isAdmin && sp.contact ? sp.contact : undefined }), isAdmin ? orgMonthlySummary(ctx) : Promise.resolve(null), isAdmin ? listOrgContacts(ctx, ctx.orgId) : Promise.resolve([])]);
  const needsReply = rows.filter((t) => t.status === "pending_client");
  const resolved = rows.filter((t) => t.status === "resolved");
  const others = rows.filter((t) => t.status !== "pending_client" && t.status !== "resolved");
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg">Hi {firstName(ctx.fullName)}</h1>
          <p className="text-body-md mt-1 text-on-surface-variant">{isAdmin ? "All requests from your organisation." : "Your requests and what needs your attention."}</p>
        </div>
        <Link href="/portal/new" className={cn(buttonVariants({ variant: "primary", size: "lg" }))}><Plus strokeWidth={1.75} /> New request</Link>
      </div>
      {summary ? (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
          <StatTile label="Open" value={summary.open} />
          <StatTile label="Created this month" value={summary.created} />
          <StatTile label="Resolved this month" value={summary.resolved} />
          <StatTile label="Avg resolution" value={fmtMinutes(summary.avgResolutionMin)} />
          <StatTile label="SLA met" value={summary.slaMetPct === null ? "—" : `${summary.slaMetPct}%`} hint={summary.minutesLogged !== null ? `${fmtMinutes(summary.minutesLogged)} logged` : undefined} />
        </div>
      ) : null}
      <PortalFilters scope={scope} q={sp.q ?? ""} contacts={isAdmin ? contacts.map((c) => ({ id: c.id, name: c.fullName })) : []} contact={sp.contact ?? ""} />
      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title={scope === "open" ? "No open requests" : "Nothing here"} body="Raise a new request and we'll get back to you within the target time for its priority." action={<Link href="/portal/new" className={cn(buttonVariants({ variant: "primary" }))}>New request</Link>} />
      ) : (
        <div className="flex flex-col gap-6">
          {needsReply.length ? (
            <section aria-labelledby="needs-reply">
              <h2 id="needs-reply" className="text-headline-sm mb-3 text-warning-fg">Waiting for you — reply to continue</h2>
              <div className="flex flex-col gap-3">{needsReply.map((t) => <RequestCard key={t.id} t={t} highlight />)}</div>
            </section>
          ) : null}
          {resolved.length ? (
            <section aria-labelledby="resolved">
              <h2 id="resolved" className="text-headline-sm mb-3">Resolved — please confirm</h2>
              <div className="flex flex-col gap-3">{resolved.map((t) => <RequestCard key={t.id} t={t} />)}</div>
            </section>
          ) : null}
          {others.length ? (
            <section aria-labelledby="open">
              <h2 id="open" className="text-headline-sm mb-3">{scope === "open" ? "In progress" : "Requests"}</h2>
              <div className="flex flex-col gap-3">{others.map((t) => <RequestCard key={t.id} t={t} />)}</div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
