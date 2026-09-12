"use client";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Building2, Check, ChevronDown, Link2, Tag, UserRoundCheck, UserRoundPlus, UsersRound } from "lucide-react";
import { useState, useTransition } from "react";
import { assignTicket, addParticipant, escalateTicket, extendSla, linkTickets, overridePriority, removeParticipant, setCategory, setImpactUrgency, setTags, setWorkState, transitionTicket } from "@/lib/actions/tickets";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Menu, Popover } from "@/components/ui/menu";
import { Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, StatusBadge, WorkStateChip } from "./badges";
import { useDirectory } from "./staff-directory";
import { actionsFor, type TicketAction } from "@/lib/domain/ticket-machine";
import { computePriority } from "@/lib/domain/priority";
import { HOLD_REASONS, HOLD_REASON_LABEL, LEVELS, PRIORITIES, PRIORITY_LABEL, RESOLUTION_CODES, RESOLUTION_CODE_LABEL, WORK_STATES, WORK_STATE_LABEL, STAFF_STATUS_LABEL, type HoldReason, type Level3, type Priority, type ResolutionCode, type TicketStatus, type WorkState } from "@/lib/domain/types";
import type { TicketDetail } from "@/lib/dal/tickets";
import { badge as slaBadge, type TimerRow } from "@/lib/domain/sla-timers";
import { SLA_META } from "@/lib/design/status";
import { Chip } from "@/components/ui/badge";
import { cn, dueLabel, formatDateTime, relativeTime } from "@/lib/utils";

type Viewer = { userId: string; role: "agent" | "developer" | "lead" | "admin"; perms: string[] };

const ACTION_LABEL: Record<TicketAction, string> = { acknowledge: "Acknowledge", start: "Start work", ask_client: "Ask the client", hold: "Put on hold", unhold: "Resume", submit: "Submit for review", return: "Return", approve: "Approve", resolve: "Resolve", reopen: "Reopen", close: "Close", cancel: "Cancel ticket", client_reply: "" };
const ACTION_PERM: Partial<Record<TicketAction, string>> = { acknowledge: "ticket.transition.acknowledge", start: "ticket.transition.start", ask_client: "ticket.transition.pending_client", hold: "ticket.transition.on_hold", unhold: "ticket.transition.on_hold", resolve: "ticket.transition.resolve", reopen: "ticket.transition.reopen", close: "ticket.transition.close", cancel: "ticket.transition.cancel" };

/** FR-AG-05 properties panel — order never changes (design.md §12.12). */
export function PropertiesPanel({ t, viewer, onSubmitReview, onReview }: { t: TicketDetail; viewer: Viewer; onSubmitReview?: () => void; onReview?: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const dir = useDirectory();
  const can = (p: string) => viewer.perms.includes(p);
  const isDev = viewer.role === "developer";
  const terminal = t.status === "closed" || t.status === "cancelled";
  const actions = actionsFor({ status: t.status, assigneeId: t.assigneeId }, { userId: viewer.userId, role: viewer.role, orgId: "" }).filter((a) => a !== "submit" && a !== "approve" && a !== "return" && (!ACTION_PERM[a] || can(ACTION_PERM[a]!)));
  const [sheet, setSheet] = useState<TicketAction | null>(null);
  const [form, setForm] = useState<{ resolutionCode: ResolutionCode; resolutionNote: string; holdReason: HoldReason; holdNote: string; reason: string; message: string }>({ resolutionCode: "fixed", resolutionNote: "", holdReason: "awaiting_vendor", holdNote: "", reason: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = <T,>(p: Promise<{ ok: true; data: T } | { ok: false; message: string; fields?: Record<string, string> }>, okMsg?: string, undo?: () => Promise<unknown>) =>
    start(async () => {
      const r = await p;
      if (!r.ok) {
        setErrors(r.fields ?? {});
        toast({ title: r.message, tone: "error" });
        return;
      }
      setErrors({});
      if (okMsg) toast({ title: okMsg, tone: "success", undo: undo ? async () => { await undo(); router.refresh(); } : undefined });
      router.refresh();
    });

  const doTransition = (action: TicketAction) => {
    if (action === "resolve" || action === "hold" || action === "cancel" || action === "ask_client") return setSheet(action);
    run(transitionTicket({ ticketId: t.id, action: action as never, expectedVersion: t.version }), `${ACTION_LABEL[action]} — done`);
  };
  const submitSheet = () => {
    if (!sheet) return;
    const payload = sheet === "resolve" ? { resolutionCode: form.resolutionCode, resolutionNote: form.resolutionNote } : sheet === "hold" ? { holdReason: form.holdReason, holdNote: form.holdNote } : sheet === "cancel" ? { reason: form.reason } : { message: form.message };
    start(async () => {
      const r = await transitionTicket({ ticketId: t.id, action: sheet as never, expectedVersion: t.version, ...payload });
      if (!r.ok) {
        setErrors(r.fields ?? {});
        toast({ title: r.message, tone: "error" });
        return;
      }
      setSheet(null);
      toast({ title: `${STAFF_STATUS_LABEL[r.data.status as TicketStatus]}`, tone: "success" });
      router.refresh();
    });
  };

  const computed = computePriority(t.impact, t.urgency);
  const now = new Date();

  return (
    <aside className="flex flex-col gap-5" aria-label="Properties">
      {/* Primary actions */}
      <div className="flex flex-col gap-2">
        {isDev && t.assigneeId === viewer.userId && t.status === "in_progress" && onSubmitReview ? (
          <Button onClick={onSubmitReview} size="lg" data-testid="submit-review">
            Submit for review
          </Button>
        ) : null}
        {!isDev && t.status === "in_review" && can("ticket.review") && onReview ? (
          <Button onClick={onReview} size="lg" data-testid="open-review">
            Review submission
          </Button>
        ) : null}
        {!t.assigneeId && can("ticket.take") && !terminal ? (
          <Button variant={t.status === "in_review" ? "outline" : "primary"} size="lg" onClick={() => run(assignTicket({ ticketId: t.id, assigneeId: viewer.userId }), "Assigned to you", () => assignTicket({ ticketId: t.id, assigneeId: null }))} loading={pending} data-testid="take">
            <UserRoundCheck strokeWidth={1.75} /> Take
          </Button>
        ) : null}
        {actions.length ? (
          <Menu.Root>
            <Menu.Trigger className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-md border-[1.5px] border-primary-container px-4 text-label text-primary-container hover:bg-surface-container-low disabled:opacity-50" disabled={pending} data-testid="status-menu">
              Change status <ChevronDown className="size-4" strokeWidth={1.75} />
            </Menu.Trigger>
            <Menu.Content align="end" className="min-w-56">
              {actions.map((a) => (
                <Menu.Item key={a} onClick={() => doTransition(a)} data-testid={`action-${a}`} className={a === "cancel" ? "text-error" : undefined}>
                  {ACTION_LABEL[a]}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Root>
        ) : null}
      </div>

      <dl className="flex flex-col gap-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-[var(--shadow-1)]">
        <Row label="Status">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={t.status} />
            {t.escalationLevel > 0 ? <Chip tone="danger" icon={AlertTriangle}>Escalated L{t.escalationLevel}</Chip> : null}
          </div>
          {t.status === "on_hold" && t.holdReason ? <p className="text-body-sm mt-1 text-on-surface-variant">{HOLD_REASON_LABEL[t.holdReason]}{t.holdNote ? ` — ${t.holdNote}` : ""}</p> : null}
        </Row>

        {(t.workState || (isDev && t.assigneeId === viewer.userId)) && can("ticket.work_state") ? (
          <Row label="Work state">
            <WorkStatePicker ticketId={t.id} value={t.workState} disabled={terminal || t.status === "in_review" || (isDev && t.assigneeId !== viewer.userId)} onDone={() => router.refresh()} />
          </Row>
        ) : t.workState ? (
          <Row label="Work state">
            <WorkStateChip workState={t.workState} />
          </Row>
        ) : null}

        <Row label="Priority">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={t.priority} />
            {t.priorityOverridden ? <span className="text-body-sm text-on-surface-variant">overridden</span> : null}
            {can("ticket.priority.override") && !terminal ? (
              <Popover.Root>
                <Popover.Trigger className="text-label text-secondary hover:underline">Override</Popover.Trigger>
                <Popover.Content className="w-72">
                  <OverrideForm ticketId={t.id} current={t.priority} computed={computed} onDone={() => router.refresh()} />
                </Popover.Content>
              </Popover.Root>
            ) : null}
          </div>
          {can("ticket.impact") && !terminal ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-body-sm text-on-surface-variant">
                Impact
                <NativeSelect className="mt-1 h-9" value={t.impact} onChange={(e) => run(setImpactUrgency({ ticketId: t.id, impact: e.target.value as Level3 }), "Impact updated")} aria-label="Impact">
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l[0]!.toUpperCase() + l.slice(1)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="text-body-sm text-on-surface-variant">
                Urgency
                <NativeSelect className="mt-1 h-9" value={t.urgency} onChange={(e) => run(setImpactUrgency({ ticketId: t.id, urgency: e.target.value as Level3 }), "Urgency updated")} aria-label="Urgency">
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l[0]!.toUpperCase() + l.slice(1)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            </div>
          ) : (
            <p className="text-body-sm mt-1 text-on-surface-variant">Impact {t.impact} · urgency {t.urgency}</p>
          )}
        </Row>

        <Row label="Assignee">
          {can("ticket.assign") && !terminal ? (
            <AssigneePicker ticketId={t.id} value={t.assigneeId} name={t.assignee?.fullName ?? null} onDone={() => router.refresh()} />
          ) : t.assignee ? (
            <span className="flex items-center gap-2 text-body-md">
              <Avatar name={t.assignee.fullName} size={24} /> {t.assignee.fullName}
              <span className="text-body-sm text-on-surface-variant">· {t.assignee.roleId}</span>
            </span>
          ) : (
            <span className="text-body-md italic text-on-surface-variant">Unassigned</span>
          )}
        </Row>

        <Row label="Client">
          <a href={`/app/clients/${t.org.id}`} className="flex items-center gap-2 text-body-md hover:text-secondary hover:underline">
            <Avatar name={t.org.name} size={24} kind="org" /> {t.org.name}
            <span className="text-overline rounded-full bg-surface-container px-1.5 py-0.5 text-on-surface-variant">{t.org.tier}</span>
          </a>
          <p className="text-body-sm mt-1 text-on-surface-variant">
            {t.requester.fullName} · <a href={`mailto:${t.requester.email}`} className="hover:underline">{t.requester.email}</a>
          </p>
        </Row>

        <Row label="Category">
          {can("ticket.category") && !terminal ? (
            <CategoryPicker ticketId={t.id} categoryId={t.categoryId} subcategoryId={t.subcategoryId} onDone={() => router.refresh()} />
          ) : (
            <span className="text-body-md">{t.categoryName ?? "—"}{t.subcategoryName ? ` / ${t.subcategoryName}` : ""}</span>
          )}
        </Row>

        <Row label="SLA">
          <ul className="flex flex-col gap-1.5">
            {t.timers.length === 0 ? <li className="text-body-sm text-on-surface-variant">No SLA targets</li> : null}
            {t.timers.map((tm) => {
              const b = slaBadge(tm as TimerRow, now, t.policy.calendar);
              const state = b.state === "running" && b.ratio >= 0.75 ? "at_risk" : b.state;
              const meta = SLA_META[state];
              return (
                <li key={tm.id} className="flex items-center justify-between gap-2 text-body-sm" data-testid={`sla-${tm.metric}`}>
                  <span className="text-on-surface-variant">{tm.metric === "first_response" ? "First response" : "Resolution"}</span>
                  <span className="flex items-center gap-2">
                    <span className={cn("tabular", state === "breached" || state === "met_late" ? "text-danger-fg" : state === "at_risk" ? "text-warning-fg" : "text-primary")} title={formatDateTime(tm.dueAt)}>
                      {tm.metAt ? (tm.breachedAt ? "met late" : "met") : tm.pausedAt ? "paused" : dueLabel(tm.dueAt)}
                    </span>
                    <Chip tone={meta.tone} icon={meta.icon}>{meta.label}</Chip>
                  </span>
                </li>
              );
            })}
          </ul>
          {can("ticket.sla.extend") && !terminal && t.timers.some((x) => !x.metAt) ? (
            <Popover.Root>
              <Popover.Trigger className="text-label mt-2 text-secondary hover:underline">Extend a due date</Popover.Trigger>
              <Popover.Content className="w-72">
                <ExtendForm ticketId={t.id} metrics={t.timers.filter((x) => !x.metAt).map((x) => x.metric)} onDone={() => router.refresh()} />
              </Popover.Content>
            </Popover.Root>
          ) : null}
        </Row>

        {can("ticket.tags") ? (
          <Row label="Tags">
            <TagsEditor ticketId={t.id} tags={t.tags} onDone={() => router.refresh()} />
          </Row>
        ) : t.tags.length ? (
          <Row label="Tags">
            <span className="flex flex-wrap gap-1">{t.tags.map((x) => <Chip key={x} icon={Tag}>{x}</Chip>)}</span>
          </Row>
        ) : null}

        <Row label="People">
          <ul className="flex flex-col gap-1 text-body-sm">
            {t.participants.map((p) => (
              <li key={p.userId} className="flex items-center gap-2">
                <Avatar name={p.fullName} size={24} />
                <span className="flex-1 truncate">{p.fullName}</span>
                <span className="text-on-surface-variant">{p.kind}</span>
                {(can("ticket.participants") || can("ticket.watchers")) && !terminal ? (
                  <button className="text-on-surface-variant hover:text-error" onClick={() => run(removeParticipant({ ticketId: t.id, userId: p.userId, kind: p.kind }), "Removed")} aria-label={`Remove ${p.fullName}`}>
                    ×
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {!terminal && (can("ticket.watchers") || can("ticket.participants")) ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {can("ticket.watchers") ? (
                <Menu.Root>
                  <Menu.Trigger className="text-label inline-flex items-center gap-1 text-secondary hover:underline"><UsersRound className="size-4" strokeWidth={1.75} /> Add watcher</Menu.Trigger>
                  <Menu.Content className="max-h-64 overflow-y-auto">
                    {dir.staff.map((s) => (
                      <Menu.Item key={s.id} onClick={() => run(addParticipant({ ticketId: t.id, userId: s.id, kind: "watcher" }), `${s.fullName} is watching`)}>
                        {s.fullName}
                      </Menu.Item>
                    ))}
                  </Menu.Content>
                </Menu.Root>
              ) : null}
              {can("ticket.participants") ? <ParticipantAdder ticketId={t.id} orgId={t.org.id} onDone={() => router.refresh()} /> : null}
            </div>
          ) : null}
        </Row>

        <Row label="Links">
          <ul className="flex flex-col gap-1 text-body-sm">
            {t.links.map((l) => (
              <li key={l.id}>
                <a href={`/app/tickets/${l.linkedKey}`} className="flex items-center gap-1.5 hover:underline">
                  <Link2 className="size-3.5 text-on-surface-variant" strokeWidth={1.75} />
                  <span className="text-on-surface-variant">{l.kind.replace("_", " ")}</span>
                  <span className="text-mono">{l.linkedKey}</span>
                  <span className="truncate">{l.linkedSubject}</span>
                </a>
              </li>
            ))}
          </ul>
          {can("ticket.link") && !terminal ? (
            <Popover.Root>
              <Popover.Trigger className="text-label mt-1 text-secondary hover:underline">Link a ticket</Popover.Trigger>
              <Popover.Content className="w-72">
                <LinkForm ticketId={t.id} onDone={() => router.refresh()} />
              </Popover.Content>
            </Popover.Root>
          ) : null}
        </Row>

        {can("ticket.escalate") && !terminal ? (
          <Row label="Escalation">
            <Popover.Root>
              <Popover.Trigger className="text-label inline-flex items-center gap-1 text-secondary hover:underline"><ArrowUpRight className="size-4" strokeWidth={1.75} /> Escalate (level {Math.min(3, t.escalationLevel + 1)})</Popover.Trigger>
              <Popover.Content className="w-72">
                <ReasonForm label="Why escalate?" cta="Escalate" onSubmit={(reason) => escalateTicket({ ticketId: t.id, reason })} onDone={() => router.refresh()} />
              </Popover.Content>
            </Popover.Root>
          </Row>
        ) : null}

        <Row label="Details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body-sm">
            <dt className="text-on-surface-variant">Created</dt><dd title={formatDateTime(t.createdAt)}>{relativeTime(t.createdAt)} via {t.source}</dd>
            <dt className="text-on-surface-variant">Updated</dt><dd>{relativeTime(t.updatedAt)}</dd>
            {t.firstRespondedAt ? <><dt className="text-on-surface-variant">First response</dt><dd>{formatDateTime(t.firstRespondedAt)}</dd></> : null}
            {t.resolvedAt ? <><dt className="text-on-surface-variant">Resolved</dt><dd>{formatDateTime(t.resolvedAt)}{t.resolutionCode ? ` · ${RESOLUTION_CODE_LABEL[t.resolutionCode]}` : ""}</dd></> : null}
            {t.closedAt ? <><dt className="text-on-surface-variant">Closed</dt><dd>{formatDateTime(t.closedAt)}</dd></> : null}
            {t.reopenedCount ? <><dt className="text-on-surface-variant">Reopened</dt><dd>{t.reopenedCount}×</dd></> : null}
          </dl>
        </Row>
      </dl>

      {/* Transition sheet for actions with required fields */}
      <Sheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        title={sheet ? ACTION_LABEL[sheet] : ""}
        description={sheet === "resolve" ? "The resolution note is sent to the client and stops the SLA clock." : sheet === "hold" ? "Pauses the resolution clock while blocked." : sheet === "cancel" ? "Cancelled tickets are final. The client will be notified." : "Moves the ticket to Waiting for client and pauses the clock."}
        footer={
          <>
            <Button variant="outline" onClick={() => setSheet(null)}>Back</Button>
            <Button onClick={submitSheet} loading={pending} variant={sheet === "cancel" ? "destructive" : "primary"} data-testid="sheet-confirm">
              {sheet ? ACTION_LABEL[sheet] : ""}
            </Button>
          </>
        }
      >
        {sheet === "resolve" ? (
          <div className="flex flex-col gap-4">
            <Field label="Resolution code" required>
              {(p) => (
                <NativeSelect {...p} value={form.resolutionCode} onChange={(e) => setForm({ ...form, resolutionCode: e.target.value as ResolutionCode })}>
                  {RESOLUTION_CODES.filter((c) => c !== "cancelled_by_client" && c !== "no_response").map((c) => (
                    <option key={c} value={c}>{RESOLUTION_CODE_LABEL[c]}</option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Resolution note (visible to client)" required error={errors.resolutionNote}>
              {(p) => <Textarea {...p} rows={6} value={form.resolutionNote} onChange={(e) => setForm({ ...form, resolutionNote: e.target.value })} data-autofocus placeholder="What was done, and what the client should check." />}
            </Field>
          </div>
        ) : sheet === "hold" ? (
          <div className="flex flex-col gap-4">
            <Field label="Hold reason" required>
              {(p) => (
                <NativeSelect {...p} value={form.holdReason} onChange={(e) => setForm({ ...form, holdReason: e.target.value as HoldReason })} data-autofocus>
                  {HOLD_REASONS.map((r) => (
                    <option key={r} value={r}>{HOLD_REASON_LABEL[r]}</option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Note" required={form.holdReason === "other"} error={errors.holdNote}>
              {(p) => <Textarea {...p} value={form.holdNote} onChange={(e) => setForm({ ...form, holdNote: e.target.value })} placeholder="What are we waiting for?" />}
            </Field>
          </div>
        ) : sheet === "cancel" ? (
          <Field label="Reason" required error={errors.reason}>
            {(p) => <Textarea {...p} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-autofocus placeholder="Why is this ticket being cancelled?" />}
          </Field>
        ) : (
          <Field label="Your question to the client" required error={errors.message} hint="Sent as a public reply. The client sees “Waiting for you — reply to continue”.">
            {(p) => <Textarea {...p} rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} data-autofocus />}
          </Field>
        )}
      </Sheet>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-overline mb-1.5 text-on-surface-variant">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function WorkStatePicker({ ticketId, value, disabled, onDone }: { ticketId: string; value: WorkState | null; disabled?: boolean; onDone: () => void }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [pendingState, setPendingState] = useState<WorkState | null>(null);
  const [busy, setBusy] = useState(false);
  const apply = async (ws: WorkState, n?: string) => {
    setBusy(true);
    const r = await setWorkState({ ticketId, workState: ws, note: n ?? null });
    setBusy(false);
    if (!r.ok) {
      toast({ title: r.message, tone: "error" });
      return;
    }
    setPendingState(null);
    setNote("");
    toast({ title: `Work state: ${WORK_STATE_LABEL[ws]}`, tone: "success" });
    onDone();
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Work state">
        {WORK_STATES.map((ws) => (
          <button
            key={ws}
            role="radio"
            aria-checked={value === ws}
            disabled={disabled || busy}
            data-testid={`work-state-${ws}`}
            onClick={() => (ws === "blocked" || ws === "needs_info" ? setPendingState(ws) : void apply(ws))}
            className={cn("pressable rounded-full border px-2.5 py-1 text-[11px] font-heading font-semibold uppercase tracking-[0.06em] disabled:opacity-50", value === ws ? "border-primary-container bg-primary-container text-on-primary" : "border-outline-variant text-on-surface-variant hover:border-outline")}
          >
            {WORK_STATE_LABEL[ws]}
          </button>
        ))}
      </div>
      {pendingState ? (
        <div className="mt-2 flex flex-col gap-2 rounded-md border border-warning-border bg-warning-bg/50 p-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={pendingState === "blocked" ? "What is blocking you? The admin will be notified." : "What do you need? Ask the client in the thread, or hand back to the admin."} rows={2} aria-label="Note" autoFocus />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPendingState(null)}>Cancel</Button>
            <Button size="sm" onClick={() => void apply(pendingState, note)} loading={busy} disabled={!note.trim()}>Set {WORK_STATE_LABEL[pendingState]}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssigneePicker({ ticketId, value, name, onDone }: { ticketId: string; value: string | null; name: string | null; onDone: () => void }) {
  const { staff } = useDirectory();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const pick = async (id: string | null) => {
    setBusy(true);
    const r = await assignTicket({ ticketId, assigneeId: id });
    setBusy(false);
    if (!r.ok) return toast({ title: r.message, tone: "error" });
    toast({ title: id ? `Assigned to ${staff.find((s) => s.id === id)?.fullName ?? "staff"}` : "Unassigned", tone: "success", undo: async () => { await assignTicket({ ticketId, assigneeId: value }); onDone(); } });
    onDone();
  };
  const devs = staff.filter((s) => s.roleId === "developer");
  const others = staff.filter((s) => s.roleId !== "developer");
  return (
    <Menu.Root>
      <Menu.Trigger disabled={busy} className="pressable flex h-9 w-full items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 text-left text-body-md hover:border-outline disabled:opacity-50" data-testid="assignee-picker">
        {name ? <><Avatar name={name} size={24} /> <span className="flex-1 truncate">{name}</span></> : <span className="flex-1 italic text-on-surface-variant">Unassigned — choose a developer</span>}
        <ChevronDown className="size-4 text-on-surface-variant" strokeWidth={1.75} />
      </Menu.Trigger>
      <Menu.Content className="max-h-80 w-72 overflow-y-auto">
        <Menu.Group>
          <Menu.Label>Developers</Menu.Label>
          {devs.map((s) => (
            <Menu.Item key={s.id} onClick={() => void pick(s.id)} data-testid={`assign-${s.id}`}>
              <Avatar name={s.fullName} size={24} /> <span className="flex-1 truncate">{s.fullName}</span>
              <span className="tabular text-body-sm text-on-surface-variant">{s.workload ?? 0} open</span>
            </Menu.Item>
          ))}
        </Menu.Group>
        <Menu.Separator />
        <Menu.Group>
          <Menu.Label>Support</Menu.Label>
          {others.map((s) => (
            <Menu.Item key={s.id} onClick={() => void pick(s.id)}>
              <Avatar name={s.fullName} size={24} /> <span className="flex-1 truncate">{s.fullName}</span>
              <span className="tabular text-body-sm text-on-surface-variant">{s.workload ?? 0} open</span>
            </Menu.Item>
          ))}
        </Menu.Group>
        {value ? (<><Menu.Separator /><Menu.Item onClick={() => void pick(null)}>Unassign</Menu.Item></>) : null}
      </Menu.Content>
    </Menu.Root>
  );
}

function CategoryPicker({ ticketId, categoryId, subcategoryId, onDone }: { ticketId: string; categoryId: string | null; subcategoryId: string | null; onDone: () => void }) {
  const { categories } = useDirectory();
  const { toast } = useToast();
  const parents = categories.filter((c) => !c.parentId);
  const children = categories.filter((c) => c.parentId === categoryId);
  const save = async (cat: string | null, sub: string | null) => {
    const r = await setCategory({ ticketId, categoryId: cat, subcategoryId: sub });
    if (!r.ok) return toast({ title: r.message, tone: "error" });
    onDone();
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <NativeSelect aria-label="Category" className="h-9" value={categoryId ?? ""} onChange={(e) => void save(e.target.value || null, null)}>
        <option value="">—</option>
        {parents.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
      </NativeSelect>
      <NativeSelect aria-label="Subcategory" className="h-9" value={subcategoryId ?? ""} disabled={!children.length} onChange={(e) => void save(categoryId, e.target.value || null)}>
        <option value="">—</option>
        {children.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
      </NativeSelect>
    </div>
  );
}

function OverrideForm({ ticketId, current, computed, onDone }: { ticketId: string; current: Priority; computed: Priority; onDone: () => void }) {
  const [priority, setPriority] = useState<Priority>(current);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return (
    <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await overridePriority({ ticketId, priority, reason }); setBusy(false); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: `Priority set to ${PRIORITY_LABEL[priority]}`, tone: "success" }); onDone(); }}>
      <p className="text-body-sm text-on-surface-variant">Computed from impact × urgency: {PRIORITY_LABEL[computed]}. Overrides are logged.</p>
      <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value as Priority)} aria-label="Priority">
        {PRIORITIES.map((p) => (<option key={p} value={p}>{PRIORITY_LABEL[p]}</option>))}
      </NativeSelect>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" aria-label="Reason" required />
      <Button type="submit" size="sm" loading={busy} disabled={!reason.trim()}>Override priority</Button>
    </form>
  );
}

function ExtendForm({ ticketId, metrics, onDone }: { ticketId: string; metrics: ("first_response" | "resolution")[]; onDone: () => void }) {
  const [metric, setMetric] = useState(metrics[0]!);
  const [hours, setHours] = useState(4);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return (
    <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await extendSla({ ticketId, metric, extraMinutes: hours * 60, reason }); setBusy(false); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: "Due date extended", tone: "success" }); onDone(); }}>
      <p className="text-body-sm text-on-surface-variant">Once per ticket, logged and reported as “adjusted”.</p>
      <NativeSelect value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)} aria-label="Metric">
        {metrics.map((m) => (<option key={m} value={m}>{m.replace("_", " ")}</option>))}
      </NativeSelect>
      <Input type="number" min={1} max={720} value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Hours to add" />
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" aria-label="Reason" required />
      <Button type="submit" size="sm" loading={busy} disabled={!reason.trim()}>Extend by {hours} h</Button>
    </form>
  );
}

function LinkForm({ ticketId, onDone }: { ticketId: string; onDone: () => void }) {
  const [key, setKey] = useState("");
  const [kind, setKind] = useState<"duplicate_of" | "related" | "follow_up_of" | "blocked_by">("related");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return (
    <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await linkTickets({ ticketId, linkedKey: key.trim().toUpperCase(), kind }); setBusy(false); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: `Linked ${r.data.key}`, tone: "success" }); setKey(""); onDone(); }}>
      <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Link type">
        <option value="related">Related to</option>
        <option value="duplicate_of">Duplicate of</option>
        <option value="blocked_by">Blocked by</option>
        <option value="follow_up_of">Follow-up of</option>
      </NativeSelect>
      <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="EXP-1042" aria-label="Ticket key" className="text-mono" />
      <Button type="submit" size="sm" loading={busy} disabled={!/^EXP-\d+$/i.test(key.trim())}>Link</Button>
    </form>
  );
}

function ReasonForm({ label, cta, onSubmit, onDone }: { label: string; cta: string; onSubmit: (reason: string) => Promise<{ ok: boolean; message?: string }>; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return (
    <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await onSubmit(reason); setBusy(false); if (!r.ok) return toast({ title: r.message ?? "Failed", tone: "error" }); toast({ title: `${cta} — done`, tone: "success" }); onDone(); }}>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={label} aria-label={label} rows={3} />
      <Button type="submit" size="sm" loading={busy} disabled={!reason.trim()}>{cta}</Button>
    </form>
  );
}

function TagsEditor({ ticketId, tags, onDone }: { ticketId: string; tags: string[]; onDone: () => void }) {
  const [value, setValue] = useState("");
  const { toast } = useToast();
  const save = async (next: string[]) => {
    const r = await setTags({ ticketId, tags: next });
    if (!r.ok) return toast({ title: r.message, tone: "error" });
    onDone();
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="inline-flex h-6 items-center gap-1 rounded-full border border-outline-variant bg-surface-container-low px-2 text-[12px]">
          <Tag className="size-3 text-on-surface-variant" strokeWidth={1.75} /> {t}
          <button className="text-on-surface-variant hover:text-error" onClick={() => void save(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}>×</button>
        </span>
      ))}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            e.preventDefault();
            void save([...tags, value.trim()]);
            setValue("");
          }
        }}
        placeholder="Add tag ↵"
        aria-label="Add tag"
        className="h-6 w-24 rounded-sm border border-dashed border-outline-variant bg-transparent px-1.5 text-[12px] outline-none focus:border-secondary-container"
      />
    </div>
  );
}

function ParticipantAdder({ ticketId, orgId, onDone }: { ticketId: string; orgId: string; onDone: () => void }) {
  const [contacts, setContacts] = useState<{ id: string; fullName: string }[] | null>(null);
  const { toast } = useToast();
  return (
    <Menu.Root onOpenChange={async (open) => { if (open && !contacts) { const res = await fetch(`/api/orgs/${orgId}/contacts`); if (res.ok) setContacts(((await res.json()) as { contacts: { id: string; fullName: string }[] }).contacts); } }}>
      <Menu.Trigger className="text-label inline-flex items-center gap-1 text-secondary hover:underline"><UserRoundPlus className="size-4" strokeWidth={1.75} /> Add participant</Menu.Trigger>
      <Menu.Content className="max-h-64 overflow-y-auto">
        {!contacts ? <Menu.Item disabled>Loading…</Menu.Item> : contacts.map((c) => (
          <Menu.Item key={c.id} onClick={async () => { const r = await addParticipant({ ticketId, userId: c.id, kind: "participant" }); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: `${c.fullName} added`, tone: "success" }); onDone(); }}>
            <Check className="size-4 opacity-0" /> {c.fullName}
          </Menu.Item>
        ))}
      </Menu.Content>
    </Menu.Root>
  );
}

export function IconBuilding() {
  return <Building2 className="size-4" strokeWidth={1.75} />;
}
