import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  holdReasonEnum,
  level3Enum,
  linkKindEnum,
  participantKindEnum,
  priorityEnum,
  resolutionCodeEnum,
  reviewOutcomeEnum,
  ticketSourceEnum,
  ticketStatusEnum,
  ticketTypeEnum,
  visibilityEnum,
  workStateEnum,
} from "./enums";
import { organisations } from "./orgs";
import { users } from "./users";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const inet = customType<{ data: string }>({ dataType: () => "inet" });

export const ticketKeySeq = pgSequence("ticket_key_seq", { startWith: 1000 });

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("categories_parent_idx").on(t.parentId)],
);

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    key: text("key")
      .notNull()
      .unique()
      .default(sql`('EXP-' || nextval('ticket_key_seq'))`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id),
    assigneeId: uuid("assignee_id").references(() => users.id),
    type: ticketTypeEnum("type").notNull(),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    status: ticketStatusEnum("status").notNull().default("new"),
    holdReason: holdReasonEnum("hold_reason"),
    holdNote: text("hold_note"),
    urgency: level3Enum("urgency").notNull().default("medium"),
    impact: level3Enum("impact").notNull().default("medium"),
    priority: priorityEnum("priority").notNull(),
    priorityOverridden: boolean("priority_overridden").notNull().default(false),
    categoryId: uuid("category_id").references(() => categories.id),
    subcategoryId: uuid("subcategory_id").references(() => categories.id),
    source: ticketSourceEnum("source").notNull(),
    resolutionCode: resolutionCodeEnum("resolution_code"),
    resolutionNote: text("resolution_note"),
    cancelReason: text("cancel_reason"),
    escalationLevel: integer("escalation_level").notNull().default(0),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    workState: workStateEnum("work_state"),
    timeSpentMinutes: integer("time_spent_minutes").notNull().default(0),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedBy: uuid("submitted_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewOutcome: reviewOutcomeEnum("review_outcome"),
    firstRespondedAt: timestamp("first_responded_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lastClientReplyAt: timestamp("last_client_reply_at", { withTimezone: true }),
    lastStaffReplyAt: timestamp("last_staff_reply_at", { withTimezone: true }),
    reopenedCount: integer("reopened_count").notNull().default(0),
    customFields: jsonb("custom_fields").notNull().default({}).$type<Record<string, unknown>>(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(description,''))`,
    ),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("tickets_subject_len", sql`char_length(${t.subject}) <= 160`),
    check("tickets_description_len", sql`char_length(${t.description}) <= 20000`),
    check("tickets_hold_reason_chk", sql`(${t.status} = 'on_hold') = (${t.holdReason} is not null)`),
    check("tickets_in_review_chk", sql`${t.status} <> 'in_review' or ${t.submittedAt} is not null`),
    check(
      "tickets_resolved_chk",
      sql`${t.status} <> 'resolved' or (${t.resolutionCode} is not null and ${t.resolutionNote} is not null)`,
    ),
    index("tickets_org_status_idx").on(t.orgId, t.status),
    index("tickets_assignee_status_idx").on(t.assigneeId, t.status),
    index("tickets_status_updated_idx").on(t.status, t.updatedAt),
    index("tickets_requester_idx").on(t.requesterId),
    index("tickets_search_idx").using("gin", t.searchVector),
    index("tickets_key_trgm_idx").using("gin", sql`${t.key} gin_trgm_ops`),
  ],
);

export const ticketParticipants = pgTable(
  "ticket_participants",
  {
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: participantKindEnum("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ticketId, t.userId] }), index("ticket_participants_user_idx").on(t.userId)],
);

export const ticketLinks = pgTable(
  "ticket_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    linkedTicketId: uuid("linked_ticket_id")
      .notNull()
      .references(() => tickets.id),
    kind: linkKindEnum("kind").notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ticket_links_ticket_idx").on(t.ticketId), index("ticket_links_linked_idx").on(t.linkedTicketId)],
);

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ticketTags = pgTable(
  "ticket_tags",
  {
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (t) => [primaryKey({ columns: [t.ticketId, t.tagId] })],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    visibility: visibilityEnum("visibility").notNull(),
    body: text("body").notNull(),
    bodyHtml: text("body_html"),
    kind: text("kind").notNull().default("comment"), // comment | review_note | resolution
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("comments_body_len", sql`char_length(${t.body}) <= 20000`),
    index("comments_ticket_idx").on(t.ticketId, t.createdAt),
    index("comments_org_idx").on(t.orgId),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    commentId: uuid("comment_id").references(() => comments.id),
    submissionId: uuid("submission_id"),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => users.id),
    storageKey: text("storage_key").notNull().unique(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    scanStatus: text("scan_status").notNull().default("pending"),
    visibility: visibilityEnum("visibility").notNull().default("public"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("attachments_size_chk", sql`${t.sizeBytes} <= 26214400`),
    index("attachments_ticket_idx").on(t.ticketId),
  ],
);

// Developer time + findings (internal only).
export const workLogs = pgTable(
  "work_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    loggedOn: date("logged_on").notNull().default(sql`current_date`),
    minutes: integer("minutes").notNull(),
    note: text("note").notNull(),
    workState: workStateEnum("work_state"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("work_logs_minutes_chk", sql`${t.minutes} between 1 and 1440`),
    check("work_logs_note_len", sql`char_length(${t.note}) <= 5000`),
    index("work_logs_ticket_idx").on(t.ticketId),
    index("work_logs_user_idx").on(t.userId, t.loggedOn),
  ],
);

// A running inline timer (one per user per ticket). Stopping it prefills a work log.
export const workTimers = pgTable(
  "work_timers",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.ticketId] })],
);

// Developer → admin hand-off; one row per submit. Immutable once reviewed (trigger + RLS).
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    developerId: uuid("developer_id")
      .notNull()
      .references(() => users.id),
    findings: text("findings").notNull(),
    rootCause: text("root_cause"),
    changesMade: text("changes_made").notNull(),
    verification: text("verification").notNull(),
    suggestedResolutionCode: resolutionCodeEnum("suggested_resolution_code"),
    proposedReply: text("proposed_reply").notNull(),
    timeMinutes: integer("time_minutes").notNull(),
    timeAdjustReason: text("time_adjust_reason"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    outcome: reviewOutcomeEnum("outcome"),
    reviewerId: uuid("reviewer_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    sentReply: text("sent_reply"),
  },
  (t) => [
    check("submissions_outcome_chk", sql`${t.outcome} is null or ${t.reviewerId} is not null`),
    index("submissions_ticket_idx").on(t.ticketId, t.submittedAt),
  ],
);

// Append-only audit of everything that happens to a ticket.
export const ticketEvents = pgTable(
  "ticket_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    orgId: uuid("org_id").notNull(),
    actorId: uuid("actor_id"),
    kind: text("kind").notNull(),
    visibility: visibilityEnum("visibility").notNull().default("internal"),
    data: jsonb("data").notNull().default({}).$type<Record<string, unknown>>(),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ticket_events_ticket_idx").on(t.ticketId, t.createdAt), index("ticket_events_kind_idx").on(t.kind, t.createdAt)],
);

export const satisfactionRatings = pgTable(
  "satisfaction_ratings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id)
      .unique(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    score: integer("score").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("satisfaction_score_chk", sql`${t.score} between 1 and 5`)],
);
