import { describe, expect, it } from "vitest";
import { PERMISSION_IDS, ROLE_PERMISSIONS, hasPermission, type Permission } from "@/lib/authz/permissions";
import { can, requirePermission, SYSTEM_CONTEXT, type AuthContext } from "@/lib/authz/policy";
import { ROLES, type Role } from "@/lib/domain/types";

/**
 * Generated role × permission matrix (security.md §5 item 4). Every permission must have an explicit
 * expectation for every role - a new permission without a row here fails CI.
 * Legend: 1 = allowed, 0 = denied. Column order: client_user, client_admin, agent, developer, lead, admin.
 */
const EXPECT: Record<Permission, [number, number, number, number, number, number]> = {
  "ticket.read.org": [0, 0, 1, 0, 1, 1],
  "ticket.read.own": [1, 1, 0, 0, 0, 0],
  "ticket.read.org_client": [0, 1, 0, 0, 0, 0],
  "ticket.read.assigned": [0, 0, 0, 1, 0, 0],
  "ticket.create": [1, 1, 0, 0, 0, 0],
  "ticket.create.on_behalf": [0, 0, 1, 0, 1, 1],
  "ticket.take": [0, 0, 1, 0, 1, 1],
  "ticket.assign": [0, 0, 1, 0, 1, 1],
  "ticket.transition.acknowledge": [0, 0, 1, 0, 1, 1],
  "ticket.transition.start": [0, 0, 1, 0, 1, 1],
  "ticket.transition.pending_client": [0, 0, 1, 1, 1, 1],
  "ticket.transition.on_hold": [0, 0, 1, 1, 1, 1],
  "ticket.transition.resolve": [0, 0, 1, 0, 1, 1],
  "ticket.transition.close": [1, 1, 1, 0, 1, 1],
  "ticket.transition.cancel": [1, 1, 1, 0, 1, 1],
  "ticket.transition.reopen": [1, 1, 1, 0, 1, 1],
  "ticket.edit": [0, 0, 1, 0, 1, 1],
  "ticket.impact": [0, 0, 1, 0, 1, 1],
  "ticket.priority.override": [0, 0, 0, 0, 1, 1],
  "ticket.category": [0, 0, 1, 0, 1, 1],
  "ticket.tags": [0, 0, 1, 0, 1, 1],
  "ticket.participants": [1, 1, 1, 0, 1, 1],
  "ticket.watchers": [0, 0, 1, 0, 1, 1],
  "ticket.link": [0, 0, 1, 0, 1, 1],
  "ticket.escalate": [0, 0, 0, 0, 1, 1],
  "ticket.sla.extend": [0, 0, 0, 0, 1, 1],
  "ticket.bulk": [0, 0, 0, 0, 1, 1],
  "ticket.work_state": [0, 0, 1, 1, 1, 1],
  "ticket.submit_review": [0, 0, 1, 1, 1, 1],
  "ticket.review": [0, 0, 0, 0, 1, 1],
  "worklog.read": [0, 0, 1, 1, 1, 1],
  "worklog.write": [0, 0, 1, 1, 1, 1],
  "comment.public": [1, 1, 1, 1, 1, 1],
  "comment.internal": [0, 0, 1, 1, 1, 1],
  "attachment.upload": [1, 1, 1, 1, 1, 1],
  "attachment.download": [1, 1, 1, 1, 1, 1],
  "search.global": [0, 0, 1, 1, 1, 1],
  "saved_view.manage": [0, 0, 1, 1, 1, 1],
  "canned.read": [0, 0, 1, 1, 1, 1],
  "canned.manage": [0, 0, 1, 0, 1, 1],
  "rating.write": [1, 1, 0, 0, 0, 0],
  "dashboard.admin": [0, 0, 0, 0, 1, 1],
  "dashboard.developer": [0, 0, 0, 1, 0, 0],
  "dashboard.agent": [0, 0, 1, 0, 1, 1],
  "dashboard.client": [1, 1, 0, 0, 0, 0],
  "report.view": [0, 0, 0, 0, 1, 1],
  "org.read": [0, 0, 1, 0, 1, 1],
  "org.manage": [0, 0, 0, 0, 0, 1],
  "contact.invite": [0, 1, 0, 0, 0, 0],
  "contact.manage": [0, 0, 0, 0, 0, 1],
  "user.manage": [0, 0, 0, 0, 0, 1],
  "admin.categories": [0, 0, 0, 0, 0, 1],
  "admin.sla": [0, 0, 0, 0, 0, 1],
  "admin.templates": [0, 0, 0, 0, 0, 1],
  "admin.settings": [0, 0, 0, 0, 0, 1],
  "admin.audit": [0, 0, 0, 0, 0, 1],
  "notification.read": [1, 1, 1, 1, 1, 1],
};
const COLUMNS: Role[] = ["client_user", "client_admin", "agent", "developer", "lead", "admin"];

const ctxFor = (role: Role): AuthContext => ({
  userId: "u",
  orgId: "o",
  orgType: role.startsWith("client") ? "client" : "staff",
  role,
  email: "x@y",
  fullName: "X",
  permissions: new Set(ROLE_PERMISSIONS[role]),
  mfaVerified: true,
});

describe("authz matrix", () => {
  it("has an expectation row for every permission", () => {
    expect(Object.keys(EXPECT).sort()).toEqual([...PERMISSION_IDS].sort());
  });

  for (const permission of PERMISSION_IDS) {
    for (const [i, role] of COLUMNS.entries()) {
      const expected = EXPECT[permission][i] === 1;
      it(`${role} ${expected ? "can" : "cannot"} ${permission}`, () => {
        expect(hasPermission(role, permission)).toBe(expected);
        expect(can(ctxFor(role), permission)).toBe(expected);
        if (expected) expect(() => requirePermission(ctxFor(role), permission)).not.toThrow();
        else expect(() => requirePermission(ctxFor(role), permission)).toThrow();
      });
    }
  }

  it("system can do everything; anonymous can do nothing", () => {
    for (const p of PERMISSION_IDS) expect(can(SYSTEM_CONTEXT, p)).toBe(true);
    for (const p of PERMISSION_IDS) expect(() => requirePermission(null, p)).toThrow(/sign in/i);
  });

  it("FR-DEV-06: developers cannot resolve/close/cancel/reassign/change priority", () => {
    for (const p of ["ticket.transition.resolve", "ticket.transition.close", "ticket.transition.cancel", "ticket.assign", "ticket.take", "ticket.impact", "ticket.priority.override", "ticket.review"] as Permission[]) {
      expect(hasPermission("developer", p)).toBe(false);
    }
  });

  it("clients never get staff-only permissions", () => {
    const staffOnly = PERMISSION_IDS.filter((p) => p.startsWith("admin.") || p.startsWith("worklog.") || p === "comment.internal" || p === "ticket.review" || p === "ticket.read.org");
    for (const role of ["client_user", "client_admin"] as Role[]) for (const p of staffOnly) expect(hasPermission(role, p)).toBe(false);
  });

  it("every role in ROLES has a permission set", () => {
    for (const r of ROLES) expect(Array.isArray(ROLE_PERMISSIONS[r])).toBe(true);
  });
});
