import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { Composer } from "@/components/tickets/composer";
import { DirectoryProvider } from "@/components/tickets/staff-directory";
import { Thread } from "@/components/tickets/thread";
import { TicketDetailClient } from "@/components/tickets/ticket-detail";
import { WorkLogPanel } from "@/components/tickets/work-log-panel";
import { PriorityBadge, StatusBadge, WorkStateChip } from "@/components/tickets/badges";
import { requireUserOrRedirect } from "@/lib/auth/require";
import { listAttachments } from "@/lib/dal/attachments";
import { listCanned, listCategories } from "@/lib/dal/categories";
import { listComments } from "@/lib/dal/comments";
import { listSubmissions } from "@/lib/dal/submissions";
import { getTicketDetail } from "@/lib/dal/tickets";
import { listStaff, staffWorkload } from "@/lib/dal/users";
import { getRunningTimer, listWorkLogs } from "@/lib/dal/work-logs";
import { AppError } from "@/lib/errors";
import { TICKET_TYPE_LABEL } from "@/lib/domain/types";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return { title: key };
}

/** Ticket detail (design.md §8.3): thread + composer left, properties + work log right (sticky). */
export default async function TicketPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ review?: string }> }) {
  const { key } = await params;
  const { review } = await searchParams;
  const ctx = await requireUserOrRedirect("app", `/app/tickets/${key}`);
  if (!/^EXP-\d+$/.test(key)) notFound();
  let t;
  try {
    t = await getTicketDetail(ctx, key);
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  }
  const [comments, workLogs, submissions, attachments, staff, workload, categories, canned, timer] = await Promise.all([
    listComments(ctx, t.id),
    ctx.permissions.has("worklog.read") ? listWorkLogs(ctx, t.id) : Promise.resolve([]),
    ctx.permissions.has("worklog.read") ? listSubmissions(ctx, t.id) : Promise.resolve([]),
    listAttachments(ctx, t.id),
    listStaff(ctx, ["agent", "developer", "lead", "admin"]),
    staffWorkload(ctx),
    listCategories(ctx),
    listCanned(ctx),
    ctx.permissions.has("worklog.write") ? getRunningTimer(ctx) : Promise.resolve(null),
  ]);
  const role = ctx.role as "agent" | "developer" | "lead" | "admin";
  const viewer = { userId: ctx.userId, role, perms: [...ctx.permissions] };
  const openSubmission = submissions.find((s) => !s.outcome) ?? null;
  const locked = t.status === "closed" || t.status === "cancelled";
  const devPublicReason =
    role === "developer" && t.settings.developerPublicReply === "never"
      ? "Public replies from developers are turned off — write an internal note for the admin to send."
      : role === "developer" && t.settings.developerPublicReply === "after_first_admin_reply" && !t.lastStaffReplyAt
        ? "You can reply to the client after the admin's first reply."
        : null;

  return (
    <DirectoryProvider value={{ staff: staff.filter((s) => s.status === "active").map((s) => ({ id: s.id, fullName: s.fullName, roleId: s.roleId, workload: workload[s.id] ?? 0 })), categories: categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })), canned: canned.map((c) => ({ id: c.id, title: c.title, shortcut: c.shortcut, body: c.body })) }}>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { href: "/app/tickets", label: role === "developer" ? "My work" : "Tickets" }, { label: t.key }]} />
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
          <span className="text-mono text-primary" data-testid="ticket-key">{t.key}</span>
          <span>·</span>
          <span>{TICKET_TYPE_LABEL[t.type].staff}</span>
          <span>·</span>
          <span>{t.org.name}</span>
        </div>
        <h1 className="text-headline-md mt-1 text-primary" data-testid="ticket-subject">{t.subject}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={t.status} />
          <WorkStateChip workState={t.workState} />
          <PriorityBadge priority={t.priority} />
        </div>
      </header>
      <TicketDetailClient t={t} viewer={viewer} openSubmission={openSubmission} openReview={review === "1" && !!openSubmission && ctx.permissions.has("ticket.review")}>
        <div className="flex flex-col gap-6">
          <Thread description={t.description} comments={comments} events={t.events} submissions={submissions} attachments={attachments} />
          <Composer ticketId={t.id} ticketKey={t.key} requesterName={t.requester.fullName} viewerName={ctx.fullName} viewerRole={role} canPublic={ctx.permissions.has("comment.public") && (role !== "developer" || t.assigneeId === ctx.userId)} canInternal={ctx.permissions.has("comment.internal")} publicDisabledReason={devPublicReason} locked={locked} />
          {ctx.permissions.has("worklog.read") ? <WorkLogPanel ticketId={t.id} total={t.timeSpentMinutes} entries={workLogs} canWrite={ctx.permissions.has("worklog.write") && (role !== "developer" || t.assigneeId === ctx.userId)} viewerId={ctx.userId} runningSince={timer?.ticketId === t.id ? timer.startedAt.toISOString() : null} locked={locked} /> : null}
        </div>
      </TicketDetailClient>
    </DirectoryProvider>
  );
}
