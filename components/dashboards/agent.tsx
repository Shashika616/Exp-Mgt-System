import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { StatTile } from "./stat-tile";
import type { agentDashboard } from "@/lib/dal/stats";
import type { QueueId } from "@/lib/dal/tickets";
import { TicketList } from "@/components/tickets/ticket-list";
import type { TicketListRow } from "@/lib/dal/tickets";

type Data = Awaited<ReturnType<typeof agentDashboard>>;

/** FR-RP-03 — keep the queue moving. */
export function AgentDashboard({ data, counts, unassigned, mine }: { data: Data; counts: Record<QueueId, number>; unassigned: TicketListRow[]; mine: TicketListRow[] }) {
  const fr = data.firstResponseToday;
  const pct = fr.total ? Math.round((fr.met / fr.total) * 100) : null;
  const aging = data.pendingAging;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Unassigned" value={counts.unassigned} href="/app/tickets?queue=unassigned" tone={counts.unassigned ? "warning" : undefined} />
        <StatTile label="My tickets" value={counts.mine} href="/app/tickets?queue=mine" />
        <StatTile label="At risk / breached" value={counts.at_risk} href="/app/tickets?queue=at_risk" tone={counts.at_risk ? "danger" : undefined} />
        <StatTile label="First response today" value={pct === null ? "—" : `${pct}%`} hint={fr.total ? `${fr.met}/${fr.total}` : "no responses yet"} tone={pct !== null && pct < 90 ? "warning" : "success"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="p-0">
          <div className="p-6 pb-2">
            <CardHeader eyebrow="Needs an owner" title="Unassigned" action={<Link href="/app/tickets?queue=unassigned" className="text-label text-secondary hover:underline">Open queue</Link>} className="mb-0" />
          </div>
          <TicketList rows={unassigned} compact embedded />
        </Card>
        <Card>
          <CardHeader eyebrow="Pending client" title="Aging" action={<Link href="/app/tickets?queue=pending_client" className="text-label text-secondary hover:underline">View</Link>} />
          <dl className="grid grid-cols-4 gap-2 text-center">
            {[
              ["< 1 d", aging.d1],
              ["1–3 d", aging.d3],
              ["3–7 d", aging.d7],
              ["> 7 d", aging.older],
            ].map(([label, v]) => (
              <div key={label as string} className="rounded-md bg-surface-container-low p-3">
                <dt className="text-overline text-on-surface-variant">{label}</dt>
                <dd className={`tabular mt-1 font-heading text-[22px] font-bold ${label === "> 7 d" && (v as number) > 0 ? "text-warning-fg" : ""}`}>{v as number}</dd>
              </div>
            ))}
          </dl>
          <p className="text-body-sm mt-4 text-on-surface-variant">Waiting for a client reply. Reminders beyond 7 days are the agent&apos;s call — nothing closes automatically.</p>
        </Card>
      </div>
      <Card className="p-0">
        <div className="p-6 pb-2">
          <CardHeader eyebrow="Assigned to me" title="My tickets" action={<Link href="/app/tickets?queue=mine" className="text-label text-secondary hover:underline">Open queue</Link>} className="mb-0" />
        </div>
        <TicketList rows={mine} compact embedded />
      </Card>
    </div>
  );
}
