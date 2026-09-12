import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organisations } from "./orgs";
import { tickets } from "./tickets";
import { users } from "./users";

const inet = customType<{ data: string }>({ dataType: () => "inet" });

// In-app + email delivery record (FR-NT-01..03).
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    ticketId: uuid("ticket_id").references(() => tickets.id),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    emailStatus: text("email_status").notNull().default("skipped"), // skipped | queued | sent | failed
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt, t.createdAt)],
);

export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    name: text("name").notNull(),
    query: jsonb("query").notNull().$type<Record<string, unknown>>(),
    columns: jsonb("columns").$type<string[]>(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("saved_views_user_idx").on(t.userId)],
);

export const cannedResponses = pgTable("canned_responses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organisations.id),
  title: text("title").notNull(),
  shortcut: text("shortcut"),
  body: text("body").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Branded email templates with placeholders (FR-ADM-04).
export const emailTemplates = pgTable("email_templates", {
  id: text("id").primaryKey(), // e.g. ticket_created
  orgId: uuid("org_id")
    .notNull()
    .references(() => organisations.id),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(), // markdown-lite with {{placeholders}}
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Non-ticket admin & security actions (FR-AU-01, security.md A09). Append-only.
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    orgId: uuid("org_id"),
    actorId: uuid("actor_id"),
    actorEmail: text("actor_email"),
    action: text("action").notNull(), // e.g. user.invited, org.updated, settings.updated, access_denied
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt), index("audit_log_action_idx").on(t.action, t.createdAt)],
);

// Pre-aggregated dashboard numbers (architecture.md §13), filled nightly + today live.
export const dailyTicketStats = pgTable(
  "daily_ticket_stats",
  {
    day: date("day").notNull(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    created: integer("created").notNull().default(0),
    resolved: integer("resolved").notNull().default(0),
    closed: integer("closed").notNull().default(0),
    firstResponseMet: integer("first_response_met").notNull().default(0),
    firstResponseBreached: integer("first_response_breached").notNull().default(0),
    resolutionMet: integer("resolution_met").notNull().default(0),
    resolutionBreached: integer("resolution_breached").notNull().default(0),
    avgFirstResponseMin: integer("avg_first_response_min"),
    avgResolutionMin: integer("avg_resolution_min"),
    minutesLogged: integer("minutes_logged").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.day, t.orgId] })],
);

// Portable rate limiter storage (lib/ratelimit/postgres.ts) - used when Upstash is not configured.
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [index("rate_limits_window_idx").on(t.windowStart)],
);

export const featureFlags = pgTable("feature_flags", {
  id: text("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
});
