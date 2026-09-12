// Domain vocabulary - kept in sync with db/schema/enums.ts (the DB enums are generated from the same lists).

export const ROLES = ["client_user", "client_admin", "agent", "developer", "lead", "admin", "system"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES: readonly Role[] = ["agent", "developer", "lead", "admin", "system"];
export const CLIENT_ROLES: readonly Role[] = ["client_user", "client_admin"];
export const REVIEWER_ROLES: readonly Role[] = ["lead", "admin"];
export const isStaffRole = (r: Role) => STAFF_ROLES.includes(r);
export const isClientRole = (r: Role) => CLIENT_ROLES.includes(r);

export const TICKET_TYPES = ["incident", "service_request", "change_request", "question", "project_enquiry"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_STATUSES = [
  "new",
  "open",
  "in_progress",
  "in_review",
  "pending_client",
  "on_hold",
  "resolved",
  "closed",
  "cancelled",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TERMINAL_STATUSES: readonly TicketStatus[] = ["closed", "cancelled"];
export const OPEN_STATUSES: readonly TicketStatus[] = ["new", "open", "in_progress", "in_review", "pending_client", "on_hold"];

export const WORK_STATES = ["investigating", "fix_in_progress", "fix_ready", "blocked", "needs_info"] as const;
export type WorkState = (typeof WORK_STATES)[number];

export const LEVELS = ["low", "medium", "high"] as const;
export type Level3 = (typeof LEVELS)[number];

export const PRIORITIES = ["p1", "p2", "p3", "p4"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const HOLD_REASONS = [
  "awaiting_vendor",
  "awaiting_change_window",
  "awaiting_approval",
  "awaiting_third_party",
  "other",
] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];

export const RESOLUTION_CODES = [
  "fixed",
  "workaround",
  "configuration",
  "user_education",
  "not_reproducible",
  "duplicate",
  "wont_fix",
  "cancelled_by_client",
  "no_response",
] as const;
export type ResolutionCode = (typeof RESOLUTION_CODES)[number];

export const VISIBILITIES = ["public", "internal"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const TICKET_SOURCES = ["portal", "agent", "email", "website_form", "api"] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

export const SLA_METRICS = ["first_response", "resolution"] as const;
export type SlaMetric = (typeof SLA_METRICS)[number];

export const REVIEW_OUTCOMES = ["approved", "returned"] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export const DEVELOPER_PUBLIC_REPLY = ["always", "after_first_admin_reply", "never"] as const;
export type DeveloperPublicReply = (typeof DEVELOPER_PUBLIC_REPLY)[number];

/** Client-facing status labels (requirements.md §5.1). `in_review` collapses to "Being worked on". */
export const CLIENT_STATUS_LABEL: Record<TicketStatus, string> = {
  new: "Received",
  open: "In queue",
  in_progress: "Being worked on",
  in_review: "Being worked on",
  pending_client: "Waiting for you",
  on_hold: "On hold",
  resolved: "Resolved: please confirm",
  closed: "Closed",
  cancelled: "Cancelled",
};

/** Client-facing status *key* - what the portal exposes instead of the raw status (never `in_review`). */
export type ClientStatus = Exclude<TicketStatus, "in_review">;
export const toClientStatus = (s: TicketStatus): ClientStatus => (s === "in_review" ? "in_progress" : s);

export const STAFF_STATUS_LABEL: Record<TicketStatus, string> = {
  new: "New",
  open: "Open",
  in_progress: "In progress",
  in_review: "In review",
  pending_client: "Pending client",
  on_hold: "On hold",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const WORK_STATE_LABEL: Record<WorkState, string> = {
  investigating: "Investigating",
  fix_in_progress: "Fix in progress",
  fix_ready: "Fix ready",
  blocked: "Blocked",
  needs_info: "Needs info",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  p1: "P1 Critical",
  p2: "P2 High",
  p3: "P3 Medium",
  p4: "P4 Low",
};

export const TICKET_TYPE_LABEL: Record<TicketType, { staff: string; portal: string; help: string }> = {
  incident: {
    staff: "Incident",
    portal: "Something is broken",
    help: "An outage, error or degraded performance in a system we deliver to you.",
  },
  service_request: {
    staff: "Service request",
    portal: "I need something",
    help: "Access, a data export, an environment, configuration or training.",
  },
  change_request: {
    staff: "Change request",
    portal: "Change or enhance a feature",
    help: "New functionality or a modification to delivered software. May lead to a quote.",
  },
  question: { staff: "Question", portal: "Ask a question", help: "A how-to or consulting query." },
  project_enquiry: {
    staff: "Project enquiry",
    portal: "Start a new project",
    help: "Tell us about prospective work and we'll come back with next steps.",
  },
};

export const HOLD_REASON_LABEL: Record<HoldReason, string> = {
  awaiting_vendor: "Awaiting vendor",
  awaiting_change_window: "Awaiting change window",
  awaiting_approval: "Awaiting approval",
  awaiting_third_party: "Awaiting third party",
  other: "Other",
};

export const RESOLUTION_CODE_LABEL: Record<ResolutionCode, string> = {
  fixed: "Fixed",
  workaround: "Workaround provided",
  configuration: "Configuration change",
  user_education: "User education",
  not_reproducible: "Not reproducible",
  duplicate: "Duplicate",
  wont_fix: "Won't fix",
  cancelled_by_client: "Cancelled by client",
  no_response: "No response",
};

/** Urgency options each ticket type offers in the portal (requirements.md §4.2). */
export const TYPE_URGENCY_OPTIONS: Record<TicketType, readonly Level3[]> = {
  incident: ["low", "medium", "high"],
  service_request: ["low", "medium"],
  change_request: ["low", "medium"],
  question: ["low"],
  project_enquiry: ["low"],
};

export const TYPES_WITHOUT_RESOLUTION_SLA: readonly TicketType[] = ["project_enquiry"];

export const LINK_KINDS = ["duplicate_of", "related", "follow_up_of", "blocked_by"] as const;
export type LinkKindT = (typeof LINK_KINDS)[number];
export const LINK_KIND_LABEL: Record<LinkKindT, string> = {
  duplicate_of: "Duplicate of",
  related: "Related to",
  follow_up_of: "Follow-up of",
  blocked_by: "Blocked by",
};
