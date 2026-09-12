import type { Role } from "@/lib/domain/types";

/**
 * Role → permission matrix (architecture.md §5, requirements.md §2.1). Roles and permissions are also
 * seeded into the `roles` / `permissions` / `role_permissions` tables so custom roles can be added as data;
 * this file is the source the seed and the generated authz matrix test read from.
 */
export const PERMISSIONS = {
  // reading
  "ticket.read.org": "Read every ticket in the system (staff)",
  "ticket.read.own": "Read own tickets and tickets one participates in",
  "ticket.read.org_client": "Read all tickets of own client organisation",
  "ticket.read.assigned": "Read tickets assigned to self or watched",
  // creating
  "ticket.create": "Create a ticket for own organisation",
  "ticket.create.on_behalf": "Create a ticket on behalf of a client",
  // working
  "ticket.take": "Assign an unassigned ticket to self",
  "ticket.assign": "Assign or reassign any ticket",
  "ticket.transition.acknowledge": "new → open",
  "ticket.transition.start": "open → in_progress",
  "ticket.transition.pending_client": "→ pending_client",
  "ticket.transition.on_hold": "→ on_hold / unhold",
  "ticket.transition.resolve": "→ resolved",
  "ticket.transition.close": "resolved → closed",
  "ticket.transition.cancel": "→ cancelled",
  "ticket.transition.reopen": "resolved → open",
  "ticket.edit": "Edit subject/description/type",
  "ticket.impact": "Set impact and urgency (priority recomputed)",
  "ticket.priority.override": "Override computed priority with a reason",
  "ticket.category": "Set category/subcategory",
  "ticket.tags": "Manage tags",
  "ticket.participants": "Add participants (client CC)",
  "ticket.watchers": "Add staff watchers",
  "ticket.link": "Link tickets",
  "ticket.escalate": "Escalate manually",
  "ticket.sla.extend": "Extend an SLA due date (logged)",
  "ticket.bulk": "Bulk actions",
  "ticket.work_state": "Set developer work_state",
  "ticket.submit_review": "Submit work for review",
  "ticket.review": "Approve / return submissions",
  "worklog.read": "Read work logs",
  "worklog.write": "Log work and run the timer",
  "comment.public": "Reply visibly to the client",
  "comment.internal": "Write internal notes",
  "attachment.upload": "Upload attachments",
  "attachment.download": "Download attachments",
  "search.global": "Global search (⌘K)",
  "saved_view.manage": "Personal saved views",
  "canned.read": "Use canned responses",
  "canned.manage": "Manage canned responses",
  "rating.write": "Rate a resolution",
  // dashboards / reports
  "dashboard.admin": "Admin / lead dashboard",
  "dashboard.developer": "Developer dashboard",
  "dashboard.agent": "Agent dashboard",
  "dashboard.client": "Client dashboard",
  "report.view": "Reports",
  // orgs & people
  "org.read": "Read client organisations",
  "org.manage": "Create/edit client organisations",
  "contact.invite": "Invite contacts to own client organisation",
  "contact.manage": "Invite/deactivate contacts of any client org",
  "user.manage": "Manage staff users and roles",
  // admin console
  "admin.categories": "Manage categories",
  "admin.sla": "Manage SLA policies",
  "admin.templates": "Manage email templates",
  "admin.settings": "Auto-close and org settings",
  "admin.audit": "View the audit log",
  "notification.read": "Read own notifications",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const PERMISSION_IDS = Object.keys(PERMISSIONS) as Permission[];

const CLIENT_BASE: Permission[] = [
  "ticket.read.own",
  "ticket.create",
  "ticket.transition.cancel",
  "ticket.transition.reopen",
  "ticket.transition.close",
  "ticket.participants",
  "comment.public",
  "attachment.upload",
  "attachment.download",
  "rating.write",
  "dashboard.client",
  "notification.read",
];

const AGENT: Permission[] = [
  "ticket.read.org",
  "ticket.create.on_behalf",
  "ticket.take",
  "ticket.assign",
  "ticket.transition.acknowledge",
  "ticket.transition.start",
  "ticket.transition.pending_client",
  "ticket.transition.on_hold",
  "ticket.transition.resolve",
  "ticket.transition.close",
  "ticket.transition.cancel",
  "ticket.transition.reopen",
  "ticket.edit",
  "ticket.impact",
  "ticket.category",
  "ticket.tags",
  "ticket.participants",
  "ticket.watchers",
  "ticket.link",
  "ticket.work_state",
  "ticket.submit_review",
  "worklog.read",
  "worklog.write",
  "comment.public",
  "comment.internal",
  "attachment.upload",
  "attachment.download",
  "search.global",
  "saved_view.manage",
  "canned.read",
  "canned.manage",
  "dashboard.agent",
  "org.read",
  "notification.read",
];

const DEVELOPER: Permission[] = [
  "ticket.read.assigned",
  "ticket.transition.pending_client",
  "ticket.transition.on_hold",
  "ticket.work_state",
  "ticket.submit_review",
  "worklog.read",
  "worklog.write",
  "comment.internal",
  "comment.public", // subject to org_settings.developer_public_reply — checked server-side in createComment
  "attachment.upload",
  "attachment.download",
  "search.global",
  "saved_view.manage",
  "canned.read",
  "dashboard.developer",
  "notification.read",
];

const LEAD: Permission[] = [
  ...AGENT,
  "ticket.priority.override",
  "ticket.escalate",
  "ticket.sla.extend",
  "ticket.bulk",
  "ticket.review",
  "dashboard.admin",
  "report.view",
];

const ADMIN: Permission[] = [
  ...LEAD,
  "org.manage",
  "contact.manage",
  "user.manage",
  "admin.categories",
  "admin.sla",
  "admin.templates",
  "admin.settings",
  "admin.audit",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  client_user: CLIENT_BASE,
  client_admin: [...CLIENT_BASE, "ticket.read.org_client", "contact.invite"],
  agent: AGENT,
  developer: DEVELOPER,
  lead: dedupe(LEAD),
  admin: dedupe(ADMIN),
  system: PERMISSION_IDS,
};

function dedupe<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export function permissionsFor(role: Role): ReadonlySet<Permission> {
  return new Set(ROLE_PERMISSIONS[role]);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Roles that require TOTP MFA to use the app (FR-AUTH-03). */
export const MFA_REQUIRED_ROLES: readonly Role[] = ["admin", "lead"];
