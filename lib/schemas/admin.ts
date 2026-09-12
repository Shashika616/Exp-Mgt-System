import { z } from "zod";
import { DEVELOPER_PUBLIC_REPLY } from "@/lib/domain/types";
import { boundedInt, email, markdown, optionalText, text, uuid } from "./common";

const timeRange = z.tuple([z.string().regex(/^\d{2}:\d{2}$/), z.string().regex(/^\d{2}:\d{2}$/)]);
export const CalendarSchema = z
  .object({
    tz: text(64),
    hours: z.object({ mon: z.array(timeRange), tue: z.array(timeRange), wed: z.array(timeRange), thu: z.array(timeRange), fri: z.array(timeRange), sat: z.array(timeRange), sun: z.array(timeRange) }).strict(),
    holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(200),
  })
  .strict();
const target = z.object({ first_response_min: boundedInt(1, 60 * 24 * 30), resolution_min: boundedInt(1, 60 * 24 * 90).nullable(), calendar: z.enum(["24x7", "business"]) }).strict();
export const SlaPolicySchema = z.object({ id: uuid.optional(), name: text(80), calendar: CalendarSchema, targets: z.object({ p1: target, p2: target, p3: target, p4: target }).strict(), isDefault: z.boolean().optional() }).strict();

export const OrgSchema = z
  .object({
    id: uuid.optional(),
    name: text(120),
    tier: z.enum(["standard", "priority", "enterprise"]),
    timezone: text(64),
    slaPolicyId: uuid.nullable().optional(),
    notes: optionalText(5000),
    status: z.enum(["active", "suspended"]),
    showTimeToClient: z.boolean().optional(),
  })
  .strict();

export const InviteStaffSchema = z.object({ email, fullName: text(120), roleId: z.enum(["agent", "developer", "lead", "admin"]) }).strict();
export const InviteContactSchema = z.object({ orgId: uuid, email, fullName: text(120), roleId: z.enum(["client_user", "client_admin"]), phone: optionalText(30) }).strict();
/** client_admin inviting a colleague: org is implicit. */
export const PortalInviteSchema = z.object({ email, fullName: text(120), roleId: z.enum(["client_user", "client_admin"]) }).strict();
export const UserIdSchema = z.object({ userId: uuid }).strict();
export const SetRoleSchema = z.object({ userId: uuid, roleId: z.enum(["agent", "developer", "lead", "admin", "client_user", "client_admin"]) }).strict();

export const CategorySchema = z.object({ id: uuid.optional(), name: text(60), parentId: uuid.nullable().optional(), description: optionalText(300), active: z.boolean().optional() }).strict();
export const CannedSchema = z.object({ id: uuid.optional(), title: text(80), shortcut: optionalText(20), body: markdown(5000) }).strict();
export const TemplateSchema = z.object({ id: text(60), subject: text(200), body: markdown(10000) }).strict();
export const GlobalSettingsSchema = z.object({ developersCanSelfAssign: z.boolean().optional(), developerPublicReply: z.enum(DEVELOPER_PUBLIC_REPLY).optional(), showTimeToClient: z.boolean().optional() }).strict();
export const AuditFilterSchema = z.object({ action: optionalText(80), actorEmail: optionalText(254), from: z.string().datetime().optional(), to: z.string().datetime().optional(), page: boundedInt(1, 10000).optional() }).strict();
export const SavedViewSchema = z.object({ name: text(60), query: z.record(z.string(), z.unknown()), columns: z.array(text(40)).max(30).optional() }).strict();
export const ProfileSchema = z.object({ fullName: text(120), phone: optionalText(30), timezone: optionalText(64) }).strict();
