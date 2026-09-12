import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  primaryKey,
} from "drizzle-orm/pg-core";
import { developerPublicReplyEnum, orgTierEnum, orgTypeEnum } from "./enums";

export const slaPolicies = pgTable("sla_policies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  // {tz:"Asia/Colombo", hours:{mon:[["09:00","17:00"]],...}, holidays:["2026-02-04",...]}
  calendar: jsonb("calendar").notNull().$type<SlaCalendarJson>(),
  // {p1:{first_response_min:30,resolution_min:240,calendar:'24x7'}, ...}
  targets: jsonb("targets").notNull().$type<SlaTargetsJson>(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SlaCalendarJson = {
  tz: string;
  hours: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [string, string][]>;
  holidays: string[];
};
export type SlaTargetJson = {
  first_response_min: number;
  resolution_min: number | null;
  calendar: "24x7" | "business";
};
export type SlaTargetsJson = Record<"p1" | "p2" | "p3" | "p4", SlaTargetJson>;

export const organisations = pgTable(
  "organisations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    type: orgTypeEnum("type").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    tier: orgTierEnum("tier").notNull().default("standard"),
    timezone: text("timezone").notNull().default("Asia/Colombo"),
    slaPolicyId: uuid("sla_policy_id").references(() => slaPolicies.id),
    primaryContactId: uuid("primary_contact_id"),
    notes: text("notes"),
    status: text("status").notNull().default("active"), // active | suspended
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("organisations_type_idx").on(t.type),
  ],
);

// One row per organisation. The staff org's row holds the global policies
// (developer_public_reply, developers_can_self_assign); client org rows hold per-client overrides.
export const orgSettings = pgTable("org_settings", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organisations.id),
  developersCanSelfAssign: boolean("developers_can_self_assign").notNull().default(false),
  developerPublicReply: developerPublicReplyEnum("developer_public_reply").notNull().default("always"),
  showTimeToClient: boolean("show_time_to_client").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  orgType: orgTypeEnum("org_type").notNull(),
  label: text("label").notNull(),
});

export const permissions = pgTable("permissions", {
  id: text("id").primaryKey(),
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);
