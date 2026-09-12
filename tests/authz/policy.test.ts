import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, permissionsFor, MFA_REQUIRED_ROLES } from "@/lib/authz/permissions";
import { can, isClient, isDeveloper, isReviewer, isStaff, requireAny, requirePermission, SYSTEM_CONTEXT, type AuthContext } from "@/lib/authz/policy";

const ctx = (role: AuthContext["role"], extra: Partial<AuthContext> = {}): AuthContext => ({
  userId: "u",
  orgId: "o",
  orgType: role.startsWith("client") ? "client" : "staff",
  role,
  email: "x@y",
  fullName: "X",
  permissions: new Set(ROLE_PERMISSIONS[role]),
  mfaVerified: true,
  ...extra,
});

describe("authz policy helpers", () => {
  it("permissionsFor returns a set", () => {
    expect(permissionsFor("agent").has("ticket.assign")).toBe(true);
    expect(permissionsFor("developer").has("ticket.assign")).toBe(false);
  });
  it("custom permission sets from the DB override the code matrix (data-driven roles)", () => {
    const custom = ctx("developer", { permissions: new Set(["ticket.review"]) });
    expect(can(custom, "ticket.review")).toBe(true); // granted by data
    expect(can(custom, "worklog.write")).toBe(true); // still allowed by the code matrix fallback
  });
  it("requireAny passes with one matching permission and fails closed otherwise", () => {
    expect(() => requireAny(ctx("agent"), ["ticket.review", "ticket.assign"])).not.toThrow();
    expect(() => requireAny(ctx("client_user"), ["ticket.review", "ticket.assign"])).toThrow(/permission/i);
    expect(() => requireAny(null, ["ticket.assign"])).toThrow(/sign in/i);
    expect(() => requirePermission(undefined, "ticket.assign")).toThrow(/sign in/i);
  });
  it("role predicates", () => {
    expect(isStaff(ctx("agent"))).toBe(true);
    expect(isClient(ctx("client_admin"))).toBe(true);
    expect(isReviewer(ctx("lead"))).toBe(true);
    expect(isReviewer(ctx("agent"))).toBe(false);
    expect(isDeveloper(ctx("developer"))).toBe(true);
  });
  it("system context is never a login and can do everything", () => {
    expect(SYSTEM_CONTEXT.role).toBe("system");
    expect(can(SYSTEM_CONTEXT, "admin.audit")).toBe(true);
  });
  it("MFA is mandatory for admin and lead only", () => {
    expect([...MFA_REQUIRED_ROLES].sort()).toEqual(["admin", "lead"]);
  });
});
