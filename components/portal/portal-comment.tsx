import { Avatar } from "@/components/ui/avatar";
import { SafeHtml } from "@/components/tickets/safe-html";
import type { PortalTicket } from "@/lib/dal/portal/tickets";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

/** Server component: public comment in the portal thread. Staff show as "Name · Support/Engineer, Expendables". */
export function PortalComment({ c }: { c: PortalTicket["comments"][number] }) {
  return (
    <li className={cn("rounded-lg p-4", c.authorSide === "client" ? "bg-surface-container-low" : "border border-outline-variant/40 bg-surface-container-lowest", c.kind === "resolution" && "border-l-4 border-l-success-border")} data-testid="portal-comment">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <Avatar name={c.authorName} size={24} />
        <span className="text-label">{c.authorName}</span>
        {c.authorTitle ? <span className="text-body-sm text-on-surface-variant">· {c.authorTitle}</span> : null}
        <time className="text-body-sm ml-auto text-on-surface-variant" dateTime={c.createdAt.toISOString()} title={formatDateTime(c.createdAt)}>{relativeTime(c.createdAt)}</time>
      </header>
      <SafeHtml markdown={c.body} html={c.bodyHtml} />
    </li>
  );
}
