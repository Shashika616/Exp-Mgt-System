import "server-only";
import { redirect } from "next/navigation";
import { requirePermission as requirePermissionPure, type AuthContext } from "@/lib/authz/policy";
import type { Permission } from "@/lib/authz/permissions";
import { getSession, homeFor } from "./session";

/**
 * Layout/page helpers - redirect for UX (the real authz still runs in Server Actions via requireUser()).
 * Never used in proxy.ts (security.md A01).
 */
export async function requireUserOrRedirect(surface: "app" | "portal", next?: string): Promise<AuthContext> {
  const s = await getSession();
  if (s.kind === "anonymous") redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (s.kind === "mfa_enroll_required") redirect("/mfa/enroll");
  if (s.kind === "mfa_required") redirect(`/mfa${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  const ctx = s.ctx;
  if (surface === "app" && ctx.orgType !== "staff") redirect("/portal");
  if (surface === "portal" && ctx.orgType !== "client") redirect("/app");
  return ctx;
}

export async function requirePermissionOrRedirect(surface: "app" | "portal", permission: Permission, next?: string): Promise<AuthContext> {
  const ctx = await requireUserOrRedirect(surface, next);
  try {
    requirePermissionPure(ctx, permission);
  } catch {
    redirect(homeFor(ctx));
  }
  return ctx;
}

export { requireUser } from "./session";
export { requirePermission, requireAny } from "@/lib/authz/policy";
