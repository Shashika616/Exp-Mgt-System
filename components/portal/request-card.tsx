import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { STATUS_META, PRIORITY_META } from "@/lib/design/status";
import type { PortalTicketRow } from "@/lib/dal/portal/tickets";
import { TICKET_TYPE_LABEL, PRIORITY_LABEL } from "@/lib/domain/types";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

/** Portal list card (design.md §8.3 "My requests"): status badge + last update; tap → thread. ≥44px targets. */
export function RequestCard({ t, highlight }: { t: PortalTicketRow; highlight?: boolean }) {
  const meta = STATUS_META[t.status];
  return (
    <Link href={`/portal/tickets/${t.key}`} className={cn("soft-lift soft-lift-hover block rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4", highlight && "border-l-4 border-l-warning-border")} data-testid={`request-${t.key}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-mono text-on-surface-variant">{t.key}</span>
        <Badge tone={meta.tone} dot>{t.statusLabel}</Badge>
        <span className="text-body-sm text-on-surface-variant">{TICKET_TYPE_LABEL[t.type].staff}</span>
        <span className="text-body-sm ml-auto text-on-surface-variant">{relativeTime(t.updatedAt)}</span>
      </div>
      <p className="text-body-lg mt-2 text-primary">{t.subject}</p>
      <div className="text-body-sm mt-2 flex flex-wrap gap-x-4 gap-y-1 text-on-surface-variant">
        <span title={PRIORITY_LABEL[t.priority]}>{PRIORITY_META[t.priority].short} · {PRIORITY_LABEL[t.priority].split(" ")[1]}</span>
        {t.assigneeFirstName ? <span>With {t.assigneeFirstName}</span> : null}
        {t.requesterName ? <span>By {t.requesterName}</span> : null}
        {t.targetResponseAt ? <span>Target response by {formatDateTime(t.targetResponseAt)}</span> : t.targetResolutionAt ? <span>Target resolution by {formatDateTime(t.targetResolutionAt)}</span> : null}
      </div>
    </Link>
  );
}
