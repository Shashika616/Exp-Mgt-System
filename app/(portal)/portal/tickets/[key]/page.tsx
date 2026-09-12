import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SafeHtml } from "@/components/tickets/safe-html";
import { PortalAttachment, PortalTicketActions } from "@/components/portal/portal-ticket";
import { PortalComment } from "@/components/portal/portal-comment";
import { requireUserOrRedirect } from "@/lib/auth/require";
import { getPortalTicket } from "@/lib/dal/portal/tickets";
import { listOrgContacts } from "@/lib/dal/users";
import { AppError } from "@/lib/errors";
import { STATUS_META } from "@/lib/design/status";
import { CLIENT_STATUS_LABEL, PRIORITY_LABEL, TICKET_TYPE_LABEL, type ClientStatus } from "@/lib/domain/types";
import { formatDateTime, formatMinutes, relativeTime } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return { title: key };
}

/** FR-CP-05 thread: public comments only, status/target-dates panel, Reopen/Confirm/Cancel/Follow-up. */
export default async function PortalTicketPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const ctx = await requireUserOrRedirect("portal", `/portal/tickets/${key}`);
  if (!/^EXP-\d+$/.test(key)) notFound();
  let t;
  try {
    t = await getPortalTicket(ctx, key);
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  }
  const colleagues = (await listOrgContacts(ctx, ctx.orgId)).filter((c) => c.status === "active" && c.id !== ctx.userId).map((c) => ({ id: c.id, name: c.fullName }));
  const meta = STATUS_META[t.status as ClientStatus];
  const publicEvents = t.events.filter((e) => e.kind === "status_changed");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <Link href="/portal" className="text-label inline-flex items-center gap-1 text-secondary hover:underline"><ArrowLeft className="size-4" strokeWidth={1.75} /> My requests</Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-mono text-on-surface-variant">{t.key}</span>
          <Badge tone={meta.tone} dot>{t.statusLabel}</Badge>
          <span className="text-body-sm text-on-surface-variant">{TICKET_TYPE_LABEL[t.type].staff}</span>
        </div>
        <h1 className="text-headline-md mt-2" data-testid="portal-subject">{t.subject}</h1>
        <article className="mt-4 rounded-lg border-t-4 border-secondary-container bg-surface-container-lowest p-5 shadow-[var(--shadow-1)]">
          <p className="text-body-sm mb-2 text-on-surface-variant">Raised by {t.requesterName} · {formatDateTime(t.createdAt)}</p>
          <SafeHtml markdown={t.description} />
          {t.attachments.filter((a) => !a.commentId).length ? <div className="mt-3 flex flex-wrap gap-2">{t.attachments.filter((a) => !a.commentId).map((a) => <PortalAttachment key={a.id} a={a} />)}</div> : null}
        </article>
        <ol className="mt-4 flex flex-col gap-3" aria-label="Conversation" data-testid="portal-thread">
          {t.comments.map((c) => (
            <PortalComment key={c.id} c={c} />
          ))}
        </ol>
        <div className="mt-4">
          <PortalTicketActions t={t} colleagues={colleagues} />
        </div>
      </div>
      <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--topbar-height)+24px)] lg:self-start" aria-label="Status">
        <dl className="flex flex-col gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-[var(--shadow-1)]">
          <div><dt className="text-overline text-on-surface-variant">Status</dt><dd className="mt-1 text-body-md">{CLIENT_STATUS_LABEL[t.status]}</dd></div>
          <div><dt className="text-overline text-on-surface-variant">Priority</dt><dd className="mt-1 text-body-md">{PRIORITY_LABEL[t.priority]}</dd></div>
          {t.assigneeFirstName ? <div><dt className="text-overline text-on-surface-variant">Handled by</dt><dd className="mt-1 text-body-md">{t.assigneeFirstName}, Expendables</dd></div> : null}
          {t.targetResponseAt ? <div><dt className="text-overline text-on-surface-variant">Target response by</dt><dd className="mt-1 text-body-md">{formatDateTime(t.targetResponseAt)}</dd></div> : null}
          {t.targetResolutionAt ? <div><dt className="text-overline text-on-surface-variant">Target resolution by</dt><dd className="mt-1 text-body-md">{formatDateTime(t.targetResolutionAt)}</dd></div> : null}
          {t.timeSpentMinutes !== null ? <div><dt className="text-overline text-on-surface-variant">Time logged</dt><dd className="mt-1 text-body-md tabular">{formatMinutes(t.timeSpentMinutes)}</dd></div> : null}
          {t.participants.length ? <div><dt className="text-overline text-on-surface-variant">Also following</dt><dd className="mt-1 text-body-md">{t.participants.map((p) => p.fullName).join(", ")}</dd></div> : null}
          {t.followUpOf ? <div><dt className="text-overline text-on-surface-variant">Follow-up of</dt><dd className="mt-1 text-body-md"><Link href={`/portal/tickets/${t.followUpOf.key}`} className="text-secondary hover:underline">{t.followUpOf.key}</Link></dd></div> : null}
        </dl>
        {publicEvents.length ? (
          <ol className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4 text-body-sm shadow-[var(--shadow-1)]" aria-label="History">
            {publicEvents.map((e) => (
              <li key={e.id} className="flex justify-between gap-2 py-1"><span>{CLIENT_STATUS_LABEL[e.data.to as ClientStatus] ?? String(e.data.to)}</span><span className="text-on-surface-variant">{relativeTime(e.createdAt)}</span></li>
            ))}
          </ol>
        ) : null}
      </aside>
    </div>
  );
}
