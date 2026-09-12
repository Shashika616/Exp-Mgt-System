// Reference data: roles, permissions, categories, default SLA policy, staff org, email templates.
// Idempotent - safe to re-run. Runs as the DDL owner with app.role = system.
import { eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/authz/permissions";
import { DEFAULT_CALENDAR } from "@/lib/domain/sla-calendar";
import { DEFAULT_SLA_TARGETS } from "@/lib/domain/sla-timers";
import { ROLES, type Role } from "@/lib/domain/types";

type Db = PostgresJsDatabase<typeof schema>;

const ROLE_LABELS: Record<Role, { label: string; orgType: "staff" | "client" }> = {
  client_user: { label: "Client user", orgType: "client" },
  client_admin: { label: "Client admin", orgType: "client" },
  agent: { label: "Support agent", orgType: "staff" },
  developer: { label: "Developer", orgType: "staff" },
  lead: { label: "Support lead", orgType: "staff" },
  admin: { label: "Administrator", orgType: "staff" },
  system: { label: "System", orgType: "staff" },
};

export const CATEGORIES: { name: string; children?: string[] }[] = [
  { name: "Bug", children: ["UI", "Data integrity", "Integration", "Reporting"] },
  { name: "Performance", children: ["Slow page", "Timeout", "Database"] },
  { name: "Access", children: ["New user", "Permissions", "Password / MFA"] },
  { name: "Data", children: ["Export", "Import", "Correction"] },
  { name: "Enhancement", children: ["New feature", "Change to existing"] },
  { name: "Consulting" },
  { name: "New project" },
  { name: "Infrastructure", children: ["Hosting", "Email / DNS", "Backup"] },
];

export const EMAIL_TEMPLATES: { id: string; name: string; subject: string; body: string }[] = [
  { id: "ticket_created", name: "Ticket received", subject: "[{{ticket.key}}] We received your request", body: "Hi {{requester.first_name}},\n\nThanks, we've logged **{{ticket.subject}}** as {{ticket.key}}. We aim to respond by {{ticket.target_response}}.\n\nYou can follow progress in the portal." },
  { id: "staff_reply", name: "New reply", subject: "[{{ticket.key}}] New reply from {{agent.first_name}}", body: "Hi {{requester.first_name}},\n\n{{agent.first_name}} replied on {{ticket.key}}:\n\n> {{comment.snippet}}\n\nSign in to view and reply." },
  { id: "status_pending_client", name: "Waiting for you", subject: "[{{ticket.key}}] We need something from you", body: "Hi {{requester.first_name}},\n\nWe need a little more information to continue with {{ticket.key}}. Please reply in the portal." },
  { id: "status_resolved", name: "Resolved", subject: "[{{ticket.key}}] Resolved: please confirm", body: "Hi {{requester.first_name}},\n\nWe believe {{ticket.key}} is resolved:\n\n> {{ticket.resolution_note}}\n\nPlease confirm in the portal, or reopen if something still isn't right." },
  { id: "status_closed", name: "Closed", subject: "[{{ticket.key}}] Closed", body: "Hi {{requester.first_name}},\n\n{{ticket.key}} is now closed. If you need anything else, raise a follow-up request from the portal." },
  { id: "assigned", name: "Assigned to you (staff)", subject: "[{{ticket.key}}] Assigned to you", body: "{{ticket.key}}, {{ticket.subject}} ({{ticket.priority}}) has been assigned to you." },
  { id: "client_reply", name: "Client replied (staff)", subject: "[{{ticket.key}}] {{requester.first_name}} replied", body: "{{requester.first_name}} replied on {{ticket.key}}:\n\n> {{comment.snippet}}" },
  { id: "sla_at_risk", name: "SLA at risk (staff)", subject: "[{{ticket.key}}] SLA at risk: {{sla.metric}}", body: "{{ticket.key}} has used 75 % of its {{sla.metric}} target. Due {{sla.due_at}}." },
  { id: "sla_breached", name: "SLA breached (staff)", subject: "[{{ticket.key}}] SLA breached: {{sla.metric}}", body: "{{ticket.key}} has breached its {{sla.metric}} target ({{sla.due_at}}). Escalation level {{ticket.escalation_level}}." },
  { id: "submitted_for_review", name: "Submitted for review (staff)", subject: "[{{ticket.key}}] Ready for review", body: "{{developer.first_name}} submitted {{ticket.key}} for review ({{submission.time}} logged)." },
  { id: "review_returned", name: "Returned from review (staff)", subject: "[{{ticket.key}}] Returned from review", body: "{{reviewer.first_name}} returned {{ticket.key}} with notes:\n\n> {{review.notes}}" },
  { id: "invitation", name: "Invitation", subject: "You've been invited to Expendables Support", body: "Hi {{user.first_name}},\n\nAccept your invitation to set a password: {{invite.url}}\n\nThe link expires in 7 days." },
];

export async function seedReference(db: Db) {
  await db.execute(sql`select set_config('app.role','system',true)`);

  // Roles & permissions (data-driven authz, requirements §2.1 extension point)
  for (const role of ROLES) {
    await db.insert(schema.roles).values({ id: role, orgType: ROLE_LABELS[role].orgType, label: ROLE_LABELS[role].label }).onConflictDoUpdate({ target: schema.roles.id, set: { label: ROLE_LABELS[role].label } });
  }
  for (const [id, description] of Object.entries(PERMISSIONS)) {
    await db.insert(schema.permissions).values({ id, description }).onConflictDoUpdate({ target: schema.permissions.id, set: { description } });
  }
  await db.delete(schema.rolePermissions);
  for (const role of ROLES) {
    const perms = ROLE_PERMISSIONS[role];
    if (perms.length) await db.insert(schema.rolePermissions).values(perms.map((permissionId) => ({ roleId: role, permissionId })));
  }

  // Default SLA policy (requirements §6)
  let [policy] = await db.select().from(schema.slaPolicies).where(eq(schema.slaPolicies.isDefault, true)).limit(1);
  if (!policy) {
    [policy] = await db.insert(schema.slaPolicies).values({ name: "Standard (default)", calendar: DEFAULT_CALENDAR, targets: DEFAULT_SLA_TARGETS, isDefault: true }).returning();
  }
  const [enterprise] = await db.select().from(schema.slaPolicies).where(eq(schema.slaPolicies.name, "Enterprise 24×7")).limit(1);
  if (!enterprise) {
    await db.insert(schema.slaPolicies).values({
      name: "Enterprise 24×7",
      calendar: DEFAULT_CALENDAR,
      targets: {
        p1: { first_response_min: 15, resolution_min: 240, calendar: "24x7" },
        p2: { first_response_min: 60, resolution_min: 720, calendar: "24x7" },
        p3: { first_response_min: 240, resolution_min: 1440, calendar: "24x7" },
        p4: { first_response_min: 480, resolution_min: 2880, calendar: "24x7" },
      },
      isDefault: false,
    });
  }

  // Staff organisation
  let [staff] = await db.select().from(schema.organisations).where(eq(schema.organisations.type, "staff")).limit(1);
  if (!staff) {
    [staff] = await db.insert(schema.organisations).values({ type: "staff", name: "EXPENDABLES (PVT) LTD", slug: "expendables", tier: "enterprise", timezone: "Asia/Colombo", slaPolicyId: policy!.id }).returning();
  }
  await db.insert(schema.orgSettings).values({ orgId: staff!.id }).onConflictDoNothing();

  // Categories
  for (const [i, c] of CATEGORIES.entries()) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const [parent] = await db.insert(schema.categories).values({ name: c.name, slug, sortOrder: i }).onConflictDoUpdate({ target: schema.categories.slug, set: { sortOrder: i } }).returning();
    for (const [j, child] of (c.children ?? []).entries()) {
      await db.insert(schema.categories).values({ name: child, slug: `${slug}-${child.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, parentId: parent!.id, sortOrder: j }).onConflictDoNothing();
    }
  }

  // Email templates
  for (const t of EMAIL_TEMPLATES) {
    await db.insert(schema.emailTemplates).values({ ...t, orgId: staff!.id }).onConflictDoNothing();
  }

  // Canned responses
  const canned = [
    { title: "Acknowledged, investigating", shortcut: "ack", body: "Hi {{requester.first_name}},\n\nThanks for reporting this. We're investigating {{ticket.key}} now and will update you shortly." },
    { title: "Need more information", shortcut: "info", body: "Hi {{requester.first_name}},\n\nTo continue with {{ticket.key}} could you share:\n\n1. The exact steps you took\n2. A screenshot of the error\n3. Roughly when it last worked\n\nThanks!" },
    { title: "Resolved: please confirm", shortcut: "done", body: "Hi {{requester.first_name}},\n\nWe've resolved {{ticket.key}}. Please check on your side and confirm, or reopen the request if anything is still off." },
  ];
  for (const c of canned) {
    const [exists] = await db.select({ id: schema.cannedResponses.id }).from(schema.cannedResponses).where(eq(schema.cannedResponses.title, c.title)).limit(1);
    if (!exists) await db.insert(schema.cannedResponses).values({ ...c, orgId: staff!.id });
  }

  return { staffOrgId: staff!.id, policyId: policy!.id };
}
