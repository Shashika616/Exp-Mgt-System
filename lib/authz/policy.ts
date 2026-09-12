import { forbidden, unauthenticated } from "@/lib/errors";
import type { Role } from "@/lib/domain/types";
import { hasPermission, type Permission } from "./permissions";

/** Everything a request knows about the caller. Built by requireUser(); passed to every DAL function. */
export type AuthContext = {
  userId: string;
  orgId: string;
  orgType: "staff" | "client";
  role: Role;
  email: string;
  fullName: string;
  permissions: ReadonlySet<Permission>;
  mfaVerified: boolean;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string;
};

/** The system actor for jobs and login flows. Never derived from a request. */
export const SYSTEM_CONTEXT: AuthContext = {
  userId: "00000000-0000-0000-0000-000000000000",
  orgId: "00000000-0000-0000-0000-000000000000",
  orgType: "staff",
  role: "system",
  email: "system@expendables.local",
  fullName: "System",
  permissions: new Set(),
  mfaVerified: true,
};

export function can(ctx: AuthContext, permission: Permission): boolean {
  if (ctx.role === "system") return true;
  return ctx.permissions.has(permission) || hasPermission(ctx.role, permission);
}

/** Fail closed: throws unless the context has the permission. */
export function requirePermission(ctx: AuthContext | null | undefined, permission: Permission): AuthContext {
  if (!ctx) throw unauthenticated();
  if (!can(ctx, permission)) throw forbidden();
  return ctx;
}

export function requireAny(ctx: AuthContext | null | undefined, permissions: Permission[]): AuthContext {
  if (!ctx) throw unauthenticated();
  if (!permissions.some((p) => can(ctx, p))) throw forbidden();
  return ctx;
}

export const isStaff = (ctx: AuthContext) => ctx.orgType === "staff";
export const isClient = (ctx: AuthContext) => ctx.orgType === "client";
export const isReviewer = (ctx: AuthContext) => ctx.role === "lead" || ctx.role === "admin";
export const isDeveloper = (ctx: AuthContext) => ctx.role === "developer";
