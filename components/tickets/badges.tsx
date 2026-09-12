import { Badge, Chip } from "@/components/ui/badge";
import { PRIORITY_META, SLA_META, STATUS_META, WORK_STATE_META } from "@/lib/design/status";
import type { SlaState } from "@/lib/dal/tickets";
import { CLIENT_STATUS_LABEL, PRIORITY_LABEL, STAFF_STATUS_LABEL, WORK_STATE_LABEL, toClientStatus, type Priority, type TicketStatus, type WorkState } from "@/lib/domain/types";
import { dueLabel } from "@/lib/utils";

export function StatusBadge({ status, audience = "staff" }: { status: TicketStatus; audience?: "staff" | "client" }) {
  const s = audience === "client" ? toClientStatus(status) : status;
  return (
    <Badge tone={STATUS_META[s].tone} dot>
      {audience === "client" ? CLIENT_STATUS_LABEL[s] : STAFF_STATUS_LABEL[s]}
    </Badge>
  );
}

export function PriorityBadge({ priority, short }: { priority: Priority; short?: boolean }) {
  const m = PRIORITY_META[priority];
  return (
    <Badge tone={m.tone} icon={m.icon} title={PRIORITY_LABEL[priority]}>
      {short ? m.short : PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export function WorkStateChip({ workState }: { workState: WorkState | null }) {
  if (!workState) return null;
  const m = WORK_STATE_META[workState];
  return (
    <Chip tone={m.tone} icon={m.icon}>
      {WORK_STATE_LABEL[workState]}
    </Chip>
  );
}

export function SlaBadge({ state, dueAt, metric }: { state: SlaState; dueAt: Date | string | null; metric: "first_response" | "resolution" }) {
  const m = SLA_META[state];
  const label = metric === "first_response" ? "Response" : "Resolution";
  if (state === "none") return null;
  const when = dueAt ? dueLabel(dueAt) : "";
  return (
    <Chip tone={m.tone} icon={m.icon}>
      {label} · {state === "met" || state === "met_late" ? m.label : state === "paused" ? "paused" : when}
    </Chip>
  );
}
