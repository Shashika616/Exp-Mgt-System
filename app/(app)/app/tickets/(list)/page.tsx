import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { FilterBar } from "@/components/tickets/filter-bar";
import { DirectoryProvider } from "@/components/tickets/staff-directory";
import { DEFAULT_COLUMNS, TicketList, type Column, COLUMN_LABEL } from "@/components/tickets/ticket-list";
import { TicketListClient } from "@/components/tickets/ticket-list-client";
import { buttonVariants } from "@/components/ui/button-variants";
import { requireUserOrRedirect } from "@/lib/auth/require";
import { listCategories } from "@/lib/dal/categories";
import { listClientOrgs } from "@/lib/dal/orgs";
import { listSavedViews } from "@/lib/dal/saved-views";
import { countTickets, listTickets, queueCounts, type QueueId, type TicketFilter } from "@/lib/dal/tickets";
import { listStaff } from "@/lib/dal/users";
import { ListFilterSchema } from "@/lib/schemas/tickets";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tickets" };

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) => (v ? str(v)!.split(",").filter(Boolean) : undefined);

/** FR-AG-01/02: queues + table + saved views. Filters live in the URL (shareable, back-button friendly). */
export default async function TicketsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireUserOrRedirect("app", "/app/tickets");
  const sp = await searchParams;
  const isDev = ctx.role === "developer";
  const raw = {
    queue: str(sp.queue) ?? (isDev ? "my_work" : "all_open"),
    status: list(sp.status),
    priority: list(sp.priority),
    type: list(sp.type),
    orgId: str(sp.orgId) || undefined,
    assignee: str(sp.assignee) || undefined,
    categoryId: str(sp.categoryId) || undefined,
    sla: str(sp.sla) || undefined,
    workState: list(sp.workState),
    q: str(sp.q) || undefined,
    sort: str(sp.sort) || undefined,
    dir: str(sp.dir) || undefined,
    cursor: str(sp.cursor) || undefined,
    limit: 50,
  };
  const parsed = ListFilterSchema.safeParse(raw);
  const filter: TicketFilter = parsed.success ? (parsed.data as TicketFilter) : { queue: isDev ? "my_work" : "all_open" };
  const columns = (list(sp.cols)?.filter((c): c is Column => c in COLUMN_LABEL) ?? DEFAULT_COLUMNS) as Column[];
  const density = str(sp.density) === "compact" ? "compact" : "comfortable";

  const [counts, page, total, views, staff, categories, orgs] = await Promise.all([
    queueCounts(ctx),
    listTickets(ctx, filter),
    countTickets(ctx, filter),
    listSavedViews(ctx),
    listStaff(ctx, ["agent", "developer", "lead", "admin"]),
    listCategories(ctx),
    ctx.permissions.has("org.read") ? listClientOrgs(ctx) : Promise.resolve([]),
  ]);

  const queues: { id: QueueId; label: string; count: number }[] = isDev
    ? [
        { id: "my_work", label: "My work", count: counts.my_work },
        { id: "review", label: "In review", count: counts.review },
        { id: "all", label: "All mine", count: counts.all },
      ]
    : [
        { id: "unassigned", label: "Unassigned", count: counts.unassigned },
        { id: "mine", label: "My tickets", count: counts.mine },
        { id: "all_open", label: "All open", count: counts.all_open },
        { id: "at_risk", label: "At-risk / breached", count: counts.at_risk },
        { id: "pending_client", label: "Pending client", count: counts.pending_client },
        { id: "on_hold", label: "On hold", count: counts.on_hold },
        { id: "resolved", label: "Resolved", count: counts.resolved },
        ...(ctx.permissions.has("ticket.review") ? [{ id: "review" as const, label: "In review", count: counts.review }] : []),
        { id: "all", label: "All", count: counts.all },
      ];

  return (
    <DirectoryProvider value={{ staff: staff.map((s) => ({ id: s.id, fullName: s.fullName, roleId: s.roleId })), categories: categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })), canned: [] }}>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { label: isDev ? "My work" : "Tickets" }]} />
      <PageHeader
        title={isDev ? "My work" : "Tickets"}
        count={total}
        description={isDev ? "Tickets assigned to you, sorted by priority then SLA due." : "Queues, triage and everything in flight."}
        action={
          ctx.permissions.has("ticket.create.on_behalf") ? (
            <Link href="/app/tickets/new" className={cn(buttonVariants({ variant: "primary" }))}>
              <Plus strokeWidth={1.75} /> New ticket
            </Link>
          ) : null
        }
      />
      <Suspense>
        <FilterBar queues={queues} savedViews={views.map((v) => ({ id: v.id, name: v.name, query: v.query }))} orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} columns={columns} density={density} />
      </Suspense>
      {/* keyed by the filter so the client-side row state resets whenever filters/sort change */}
      <TicketListClient key={JSON.stringify({ ...filter, cols: columns, density })} initial={page.rows} nextCursor={page.nextCursor} filter={filter} columns={columns} compact={density === "compact"} selectable={ctx.permissions.has("ticket.bulk")} />
      <p className="text-body-sm mt-3 text-on-surface-variant">
        <kbd className="font-heading">J</kbd>/<kbd className="font-heading">K</kbd> move · <kbd className="font-heading">Enter</kbd> open{ctx.permissions.has("ticket.bulk") ? <> · <kbd className="font-heading">X</kbd> select</> : null}
      </p>
      <noscript>
        <TicketList rows={page.rows} columns={columns} />
      </noscript>
    </DirectoryProvider>
  );
}
