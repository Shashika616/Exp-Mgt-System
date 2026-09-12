import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { slaMetricEnum } from "./enums";
import { organisations } from "./orgs";
import { tickets } from "./tickets";

export const slaTimers = pgTable(
  "sla_timers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id),
    metric: slaMetricEnum("metric").notNull(),
    calendar: text("calendar").notNull().default("24x7"), // 24x7 | business
    targetMinutes: integer("target_minutes").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    elapsedMs: bigint("elapsed_ms", { mode: "number" }).notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    atRiskNotified: boolean("at_risk_notified").notNull().default(false),
    breachedAt: timestamp("breached_at", { withTimezone: true }),
    metAt: timestamp("met_at", { withTimezone: true }),
    adjustedBy: uuid("adjusted_by"),
    adjustReason: text("adjust_reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sla_timers_ticket_metric_uq").on(t.ticketId, t.metric),
    index("sla_timers_running_idx").on(t.dueAt).where(sql`${t.metAt} is null and ${t.pausedAt} is null`),
  ],
);
