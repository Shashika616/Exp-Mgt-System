import { invalidTransition } from "@/lib/errors";
import type { HoldReason, ResolutionCode, Role, TicketStatus, WorkState } from "./types";

/**
 * The state chart from requirements.md §5.2 as data — minus auto-close: closing is always a human
 * decision (client confirms, or staff closes/cancels), per the company owner. Pure: returns a patch + events + effects,
 * never touches the database. Escalation and reopen are events/flags, not statuses (ADR-04).
 */
export type TicketAction =
  | "acknowledge"
  | "start"
  | "ask_client"
  | "client_reply"
  | "hold"
  | "unhold"
  | "submit"
  | "return"
  | "approve"
  | "resolve"
  | "reopen"
  | "close"
  | "cancel";

export type Effect =
  | "sla.stop_first_response"
  | "sla.stop_resolution"
  | "sla.pause_resolution"
  | "sla.resume_resolution"
  | "sla.restart_resolution_remaining"
  | "notify.requester"
  | "notify.assignee"
  | "notify.reviewers"
  | "notify.developer"
  | "clear.work_state"
  | "set.resolved_at"
  | "set.closed_at"
  | "increment.reopened"
  | "clear.resolution";

export type RequiredField = "resolution_code" | "resolution_note" | "hold_reason" | "reason" | "submission" | "review_notes";

export type Transition = {
  to: TicketStatus;
  roles: readonly Role[];
  requires: readonly RequiredField[];
  effects: readonly Effect[];
};

const STAFF: readonly Role[] = ["agent", "lead", "admin"];
const STAFF_SYS: readonly Role[] = ["agent", "lead", "admin", "system"];
const DEV_STAFF: readonly Role[] = ["agent", "developer", "lead", "admin"];
const REVIEWERS: readonly Role[] = ["lead", "admin"];
const CLIENTS: readonly Role[] = ["client_user", "client_admin"];

export const TRANSITIONS: Readonly<Record<TicketStatus, Partial<Record<TicketAction, Transition>>>> = {
  new: {
    acknowledge: { to: "open", roles: STAFF_SYS, requires: [], effects: [] },
    start: { to: "in_progress", roles: STAFF, requires: [], effects: ["sla.stop_first_response"] },
    cancel: { to: "cancelled", roles: [...STAFF, ...CLIENTS], requires: ["reason"], effects: ["sla.stop_first_response", "sla.stop_resolution", "notify.requester", "notify.assignee"] },
  },
  open: {
    start: { to: "in_progress", roles: STAFF, requires: [], effects: ["sla.stop_first_response"] },
    resolve: { to: "resolved", roles: STAFF, requires: ["resolution_code", "resolution_note"], effects: ["sla.stop_first_response", "sla.stop_resolution", "set.resolved_at", "notify.requester", "clear.work_state"] },
    cancel: { to: "cancelled", roles: [...STAFF, ...CLIENTS], requires: ["reason"], effects: ["sla.stop_first_response", "sla.stop_resolution", "notify.requester", "notify.assignee"] },
  },
  in_progress: {
    ask_client: { to: "pending_client", roles: DEV_STAFF, requires: [], effects: ["sla.stop_first_response", "sla.pause_resolution", "notify.requester"] },
    hold: { to: "on_hold", roles: DEV_STAFF, requires: ["hold_reason"], effects: ["sla.pause_resolution"] },
    submit: { to: "in_review", roles: DEV_STAFF, requires: ["submission"], effects: ["notify.reviewers"] },
    resolve: { to: "resolved", roles: STAFF, requires: ["resolution_code", "resolution_note"], effects: ["sla.stop_first_response", "sla.stop_resolution", "set.resolved_at", "notify.requester", "clear.work_state"] },
    cancel: { to: "cancelled", roles: STAFF, requires: ["reason"], effects: ["sla.stop_resolution", "notify.requester", "notify.assignee", "clear.work_state"] },
  },
  in_review: {
    return: { to: "in_progress", roles: REVIEWERS, requires: ["review_notes"], effects: ["notify.developer"] },
    ask_client: { to: "pending_client", roles: REVIEWERS, requires: [], effects: ["sla.pause_resolution", "notify.requester"] },
    approve: { to: "resolved", roles: REVIEWERS, requires: ["resolution_code", "resolution_note"], effects: ["sla.stop_first_response", "sla.stop_resolution", "set.resolved_at", "notify.requester", "notify.developer", "clear.work_state"] },
    cancel: { to: "cancelled", roles: STAFF, requires: ["reason"], effects: ["sla.stop_resolution", "notify.requester", "notify.assignee", "clear.work_state"] },
  },
  pending_client: {
    client_reply: { to: "in_progress", roles: [...CLIENTS, "system"], requires: [], effects: ["sla.resume_resolution", "notify.assignee"] },
    resolve: { to: "resolved", roles: STAFF, requires: ["resolution_code", "resolution_note"], effects: ["sla.stop_first_response", "sla.stop_resolution", "set.resolved_at", "notify.requester", "clear.work_state"] },
    cancel: { to: "cancelled", roles: STAFF, requires: ["reason"], effects: ["sla.stop_resolution", "notify.requester", "notify.assignee", "clear.work_state"] },
  },
  on_hold: {
    unhold: { to: "in_progress", roles: DEV_STAFF, requires: [], effects: ["sla.resume_resolution"] },
    cancel: { to: "cancelled", roles: STAFF, requires: ["reason"], effects: ["sla.stop_resolution", "notify.requester", "notify.assignee", "clear.work_state"] },
  },
  resolved: {
    reopen: { to: "open", roles: [...CLIENTS, ...STAFF], requires: [], effects: ["sla.restart_resolution_remaining", "increment.reopened", "notify.assignee", "clear.resolution"] },
    close: { to: "closed", roles: [...CLIENTS, ...STAFF], requires: [], effects: ["set.closed_at", "notify.requester"] },
  },
  closed: {},
  cancelled: {},
};

export type TransitionInput = {
  resolutionCode?: ResolutionCode | null;
  resolutionNote?: string | null;
  holdReason?: HoldReason | null;
  holdNote?: string | null;
  reason?: string | null;
  submissionId?: string | null;
  reviewNotes?: string | null;
};

export type TicketSnapshot = {
  id: string;
  status: TicketStatus;
  requesterId: string;
  assigneeId: string | null;
  orgId: string;
  workState: WorkState | null;
  reopenedCount: number;
  resolutionCode?: ResolutionCode | null;
  resolutionNote?: string | null;
};

export type Actor = { userId: string | null; role: Role; orgId: string };

export type TicketPatch = {
  status: TicketStatus;
  holdReason: HoldReason | null;
  holdNote: string | null;
  resolutionCode?: ResolutionCode | null;
  resolutionNote?: string | null;
  cancelReason?: string | null;
  workState?: WorkState | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  reopenedCount?: number;
  submittedAt?: Date;
  submittedBy?: string | null;
  reviewedAt?: Date;
  reviewedBy?: string | null;
  reviewOutcome?: "approved" | "returned" | null;
};

export type TransitionResult = {
  to: TicketStatus;
  patch: TicketPatch;
  effects: readonly Effect[];
  event: { kind: "status_changed"; data: Record<string, unknown>; visibility: "public" | "internal" };
};

export function availableActions(status: TicketStatus, role: Role): TicketAction[] {
  return (Object.entries(TRANSITIONS[status]) as [TicketAction, Transition][])
    .filter(([, t]) => t.roles.includes(role))
    .map(([a]) => a);
}

export function canTransition(status: TicketStatus, action: TicketAction, role: Role): boolean {
  return TRANSITIONS[status][action]?.roles.includes(role) ?? false;
}

/**
 * Validate and compute a transition. Throws AppError('invalid_transition') with a specific message.
 * Ownership checks (a client may only act on their own ticket; a developer only on assigned tickets)
 * are applied here too so the rule lives in one place.
 */
export function transition(ticket: TicketSnapshot, action: TicketAction, actor: Actor, input: TransitionInput = {}, now: Date = new Date()): TransitionResult {
  const t = TRANSITIONS[ticket.status][action];
  if (!t) throw invalidTransition(`Cannot ${action.replace("_", " ")} a ticket that is ${ticket.status.replace("_", " ")}.`);
  if (!t.roles.includes(actor.role)) throw invalidTransition(`Your role cannot ${action.replace("_", " ")} this ticket.`);

  if (actor.role === "client_user" || actor.role === "client_admin") {
    if (ticket.orgId !== actor.orgId) throw invalidTransition("Ticket does not belong to your organisation.");
    if (action === "cancel" && !["new", "open"].includes(ticket.status)) {
      throw invalidTransition("A request can only be cancelled before work starts.");
    }
  }
  if (actor.role === "developer" && ticket.assigneeId !== actor.userId) {
    throw invalidTransition("Only the assigned developer can do that.");
  }

  for (const field of t.requires) {
    switch (field) {
      case "resolution_code":
        if (!input.resolutionCode) throw invalidTransition("A resolution code is required to resolve.");
        break;
      case "resolution_note":
        if (!input.resolutionNote?.trim()) throw invalidTransition("A resolution note for the client is required.");
        break;
      case "hold_reason":
        if (!input.holdReason) throw invalidTransition("A hold reason is required.");
        if (input.holdReason === "other" && !input.holdNote?.trim()) throw invalidTransition("Explain the hold reason.");
        break;
      case "reason":
        if (!input.reason?.trim()) throw invalidTransition("A reason is required.");
        break;
      case "submission":
        if (!input.submissionId) throw invalidTransition("A submission is required to send for review.");
        break;
      case "review_notes":
        if (!input.reviewNotes?.trim()) throw invalidTransition("Notes for the developer are required to return.");
        break;
    }
  }

  const patch: TicketPatch = {
    status: t.to,
    holdReason: t.to === "on_hold" ? (input.holdReason ?? null) : null,
    holdNote: t.to === "on_hold" ? (input.holdNote ?? null) : null,
  };
  if (t.to === "resolved") {
    patch.resolutionCode = input.resolutionCode;
    patch.resolutionNote = input.resolutionNote;
  }
  if (t.to === "cancelled") {
    patch.cancelReason = input.reason;
    patch.resolutionCode = actor.role.startsWith("client") ? "cancelled_by_client" : (input.resolutionCode ?? null);
  }
  if (action === "submit") {
    patch.submittedAt = now;
    patch.submittedBy = actor.userId;
    patch.reviewOutcome = null;
  }
  if (action === "approve" || action === "return") {
    patch.reviewedAt = now;
    patch.reviewedBy = actor.userId;
    patch.reviewOutcome = action === "approve" ? "approved" : "returned";
  }
  for (const effect of t.effects) {
    if (effect === "set.resolved_at") patch.resolvedAt = now;
    if (effect === "set.closed_at") patch.closedAt = now;
    if (effect === "increment.reopened") patch.reopenedCount = ticket.reopenedCount + 1;
    if (effect === "clear.work_state") patch.workState = null;
    if (effect === "clear.resolution") {
      patch.resolvedAt = null;
      patch.resolutionCode = null;
      patch.resolutionNote = null;
    }
  }

  // Client-visible status changes are the ones where the client label changes.
  const publiclyVisible = clientLabelChanges(ticket.status, t.to);

  return {
    to: t.to,
    patch,
    effects: t.effects,
    event: {
      kind: "status_changed",
      visibility: publiclyVisible ? "public" : "internal",
      data: {
        action,
        from: ticket.status,
        to: t.to,
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.holdReason ? { holdReason: input.holdReason } : {}),
        ...(input.resolutionCode ? { resolutionCode: input.resolutionCode } : {}),
      },
    },
  };
}

function clientLabelChanges(from: TicketStatus, to: TicketStatus): boolean {
  const collapse = (s: TicketStatus) => (s === "in_review" ? "in_progress" : s);
  return collapse(from) !== collapse(to);
}

/** Actions a role may take from a status, used to render buttons — server re-validates via transition(). */
export function actionsFor(ticket: Pick<TicketSnapshot, "status" | "assigneeId">, actor: Actor): TicketAction[] {
  return availableActions(ticket.status, actor.role).filter((a) => {
    if (actor.role === "developer") return ticket.assigneeId === actor.userId;
    if (actor.role.startsWith("client")) {
      if (a === "cancel") return ["new", "open"].includes(ticket.status);
      return a === "reopen" || a === "close";
    }
    return a !== "client_reply";
  });
}
