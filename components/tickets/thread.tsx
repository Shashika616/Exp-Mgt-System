import { ArrowRightLeft, ClipboardCheck, Lock, NotebookPen, Paperclip, Send, UserRoundCheck, Timer, Flag, CheckCircle2, Undo2, OctagonAlert } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { SafeHtml } from "./safe-html";
import type { CommentRow } from "@/lib/dal/comments";
import type { EventRow } from "@/lib/dal/events";
import type { SubmissionRow } from "@/lib/dal/submissions";
import type { AttachmentRow } from "@/lib/dal/attachments";
import { STAFF_STATUS_LABEL, WORK_STATE_LABEL, PRIORITY_LABEL, HOLD_REASON_LABEL, type TicketStatus, type WorkState, type Priority, type HoldReason } from "@/lib/domain/types";
import { cn, formatDateTime, formatMinutes, relativeTime } from "@/lib/utils";

type Item = { at: Date; key: string; node: React.ReactNode };

/**
 * Activity thread (design.md §7.11): description card with the single top accent, comments as bubbles,
 * internal notes amber with a lock, submissions as teal cards, events as timeline dots.
 */
export function Thread({ description, comments, events, submissions, attachments, audience = "staff" }: { description: string; comments: CommentRow[]; events: EventRow[]; submissions: SubmissionRow[]; attachments: AttachmentRow[]; audience?: "staff" }) {
  const byComment = new Map<string, AttachmentRow[]>();
  for (const a of attachments) if (a.commentId) byComment.set(a.commentId, [...(byComment.get(a.commentId) ?? []), a]);
  const items: Item[] = [];
  for (const c of comments) items.push({ at: c.createdAt, key: `c-${c.id}`, node: <CommentBubble c={c} attachments={byComment.get(c.id) ?? []} /> });
  for (const s of submissions) items.push({ at: s.submittedAt, key: `s-${s.id}`, node: <SubmissionCard s={s} /> });
  for (const e of events) {
    if (e.kind === "commented" || e.kind === "submitted" || e.kind === "created") continue;
    const node = eventNode(e);
    if (node) items.push({ at: e.createdAt, key: `e-${e.id}`, node });
  }
  items.sort((a, b) => a.at.getTime() - b.at.getTime());
  return (
    <div className="flex flex-col gap-4">
      <Card accent as="article">
        <h2 className="text-overline mb-3 text-on-surface-variant">Description</h2>
        <SafeHtml markdown={description} />
        {attachments.filter((a) => !a.commentId && !a.submissionId).length ? <AttachmentList items={attachments.filter((a) => !a.commentId && !a.submissionId)} /> : null}
      </Card>
      <ol className="relative flex flex-col gap-3 border-l border-outline-variant pl-6" aria-label="Activity">
        {items.map((i) => (
          <li key={i.key} className="relative">
            {i.node}
          </li>
        ))}
        {items.length === 0 ? <li className="text-body-sm text-on-surface-variant">No activity yet.</li> : null}
      </ol>
      <span className="hidden" aria-hidden>{audience}</span>
    </div>
  );
}

function Dot({ tone = "neutral", icon: Icon }: { tone?: "neutral" | "info" | "success" | "warning" | "danger" | "review" | "progress"; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  const bg = { neutral: "bg-neutral-fg", info: "bg-info-fg", success: "bg-success-fg", warning: "bg-warning-fg", danger: "bg-danger-fg", review: "bg-review-fg", progress: "bg-progress-fg" }[tone];
  return (
    <span className={cn("absolute -left-[31px] top-1 flex size-5 items-center justify-center rounded-full text-white ring-4 ring-background", bg)} aria-hidden>
      <Icon className="size-3" strokeWidth={2} />
    </span>
  );
}

export function CommentBubble({ c, attachments, clientView }: { c: { id: string; body: string; bodyHtml: string | null; visibility?: "public" | "internal"; kind: string; authorName: string; authorRole?: string; createdAt: Date; editedAt: Date | null }; attachments: { id: string; fileName: string; sizeBytes: number }[]; clientView?: { side: "client" | "staff"; title: string | null } }) {
  const internal = c.visibility === "internal";
  const isDev = c.authorRole === "developer";
  return (
    <div>
      <Dot tone={internal ? "warning" : c.kind === "resolution" ? "success" : "info"} icon={internal ? Lock : c.kind === "resolution" ? CheckCircle2 : Send} />
      <div className={cn("rounded-lg p-4", internal ? "border-l-2 border-warning-border bg-internal-note" : "bg-surface-container-low", c.kind === "resolution" && !internal && "border-l-2 border-success-border")} data-visibility={c.visibility ?? "public"}>
        <header className="mb-2 flex flex-wrap items-center gap-2">
          <Avatar name={c.authorName} size={24} />
          <span className="text-label text-primary">{c.authorName}</span>
          {clientView ? (
            clientView.title ? <span className="text-body-sm text-on-surface-variant">· {clientView.title}</span> : null
          ) : (
            <span className="text-body-sm text-on-surface-variant">· {isDev ? "Engineer" : c.authorRole?.replace("_", " ")}</span>
          )}
          {internal ? (
            <span className="text-overline flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-warning-fg">
              <Lock className="size-3" strokeWidth={2} aria-hidden /> Internal note
            </span>
          ) : c.kind === "resolution" ? (
            <span className="text-overline rounded-full bg-success-bg px-2 py-0.5 text-success-fg">Resolution</span>
          ) : null}
          <time className="text-body-sm ml-auto text-on-surface-variant" dateTime={c.createdAt.toISOString()} title={formatDateTime(c.createdAt)}>
            {relativeTime(c.createdAt)}
            {c.editedAt ? " · edited" : ""}
          </time>
        </header>
        <SafeHtml markdown={c.body} html={c.bodyHtml} />
        {attachments.length ? <AttachmentList items={attachments} /> : null}
      </div>
    </div>
  );
}

export function AttachmentList({ items }: { items: { id: string; fileName: string; sizeBytes: number }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {items.map((a) => (
        <li key={a.id}>
          <a href={`/api/attachments/${a.id}/download`} className="pressable inline-flex h-8 items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 text-body-sm text-primary hover:border-outline" download>
            <Paperclip className="size-3.5 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
            <span className="max-w-48 truncate">{a.fileName}</span>
            <span className="tabular text-on-surface-variant">{Math.max(1, Math.round(a.sizeBytes / 1024))} KB</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function SubmissionCard({ s }: { s: SubmissionRow }) {
  return (
    <div>
      <Dot tone="review" icon={ClipboardCheck} />
      <details className="rounded-lg border-t-4 border-review-border bg-review-bg/40 p-4 open:bg-review-bg/60" open={!s.outcome}>
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-label text-review-fg">
          <ClipboardCheck className="size-4" strokeWidth={1.75} aria-hidden />
          Submitted for review by {s.developerName} · {formatMinutes(s.timeMinutes)}
          {s.outcome ? <span className={cn("text-overline rounded-full px-2 py-0.5", s.outcome === "approved" ? "bg-success-bg text-success-fg" : "bg-warning-bg text-warning-fg")}>{s.outcome}</span> : <span className="text-overline rounded-full bg-review-fg px-2 py-0.5 text-white">awaiting review</span>}
          <time className="text-body-sm ml-auto font-normal text-on-surface-variant">{relativeTime(s.submittedAt)}</time>
        </summary>
        <dl className="mt-3 grid gap-3 text-body-md sm:grid-cols-2">
          <Block label="Findings" text={s.findings} />
          <Block label="Root cause" text={s.rootCause ?? "—"} />
          <Block label="What was changed" text={s.changesMade} />
          <Block label="How it was verified" text={s.verification} />
          <Block label="Proposed reply to client" text={s.proposedReply} wide />
          {s.reviewNotes ? <Block label="Reviewer notes" text={s.reviewNotes} wide /> : null}
        </dl>
      </details>
    </div>
  );
}

function Block({ label, text, wide }: { label: string; text: string; wide?: boolean }) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <dt className="text-overline text-on-surface-variant">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-primary">{text}</dd>
    </div>
  );
}

function eventNode(e: EventRow): React.ReactNode | null {
  const d = e.data as Record<string, unknown>;
  const who = e.actorName ?? "System";
  const when = <time className="text-body-sm ml-auto shrink-0 text-on-surface-variant" dateTime={e.createdAt.toISOString()} title={formatDateTime(e.createdAt)}>{relativeTime(e.createdAt)}</time>;
  const line = (tone: Parameters<typeof Dot>[0]["tone"], icon: Parameters<typeof Dot>[0]["icon"], text: React.ReactNode) => (
    <div className="flex min-h-6 items-start gap-2 text-body-sm text-on-surface-variant">
      <Dot tone={tone} icon={icon} />
      <span className="pt-0.5">{text}</span>
      {when}
    </div>
  );
  const b = (x: React.ReactNode) => <strong className="font-medium text-primary">{x}</strong>;
  switch (e.kind) {
    case "status_changed":
      return line("info", ArrowRightLeft, <>{b(who)} moved {STAFF_STATUS_LABEL[d.from as TicketStatus]} → {b(STAFF_STATUS_LABEL[d.to as TicketStatus])}{d.holdReason ? ` (${HOLD_REASON_LABEL[d.holdReason as HoldReason]})` : ""}{d.reason ? ` — ${String(d.reason)}` : ""}</>);
    case "assigned":
      return line("info", UserRoundCheck, <>{b(who)} {d.to ? "assigned this ticket" : "unassigned this ticket"}{d.note ? ` — ${String(d.note)}` : ""}</>);
    case "work_state_changed":
      return line("progress", NotebookPen, <>{b(who)} set work state to {b(WORK_STATE_LABEL[d.to as WorkState] ?? String(d.to))}{d.note ? ` — ${String(d.note)}` : ""}</>);
    case "work_logged":
      return line("progress", Timer, <>{b(who)} logged {b(formatMinutes(Number(d.minutes)))} · total {formatMinutes(Number(d.total ?? 0))}</>);
    case "priority_changed":
    case "priority_overridden":
      return line("warning", Flag, <>{b(who)} changed priority {PRIORITY_LABEL[d.from as Priority]} → {b(PRIORITY_LABEL[d.to as Priority])}{d.reason ? ` — ${String(d.reason)}` : ""}</>);
    case "review_approved":
      return line("success", CheckCircle2, <>{b(who)} approved the submission{d.replyEdited ? " (reply edited)" : ""}</>);
    case "review_returned":
      return line("warning", Undo2, <>{b(who)} returned the submission with notes</>);
    case "review_asked_client":
      return line("warning", Send, <>{b(who)} asked the client a question during review</>);
    case "sla_at_risk":
      return line("warning", Timer, <>SLA at risk — {String(d.metric).replace("_", " ")}</>);
    case "sla_breached":
      return line("danger", OctagonAlert, <>SLA breached — {String(d.metric).replace("_", " ")}</>);
    case "escalated":
      return line("danger", OctagonAlert, <>Escalated to level {String(d.level)}{d.reason ? ` — ${String(d.reason)}` : ""}</>);
    case "first_response":
      return line("success", Send, <>First response recorded</>);
    case "participant_added":
      return line("neutral", UserRoundCheck, <>{b(who)} added {String(d.name)} as a participant</>);
    case "watcher_added":
      return line("neutral", UserRoundCheck, <>{b(who)} is now watching</>);
    case "sla_extended":
      return line("warning", Timer, <>{b(who)} extended the {String(d.metric).replace("_", " ")} target by {formatMinutes(Number(d.extraMinutes))} — {String(d.reason)}</>);
    case "linked":
      return line("neutral", ArrowRightLeft, <>{b(who)} linked {String(d.key)} ({String(d.kind).replace("_", " ")})</>);
    case "attachment_added":
      return line("neutral", Paperclip, <>{b(who)} attached {String(d.fileName)}</>);
    case "edited":
      return line("neutral", NotebookPen, <>{b(who)} edited {(d.fields as string[]).join(", ")}</>);
    case "tags_changed":
      return line("neutral", NotebookPen, <>{b(who)} set tags: {(d.tags as string[]).join(", ") || "none"}</>);
    default:
      return null;
  }
}
