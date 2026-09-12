import "server-only";
import type { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { requirePermission, type AuthContext } from "@/lib/authz/policy";
import type { Permission } from "@/lib/authz/permissions";
import { AppError, toPublicError, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Thin Server Action wrapper (CLAUDE.md): requireUser → requirePermission → schema.parse → handler.
 * Errors are mapped through lib/errors (no raw messages reach the client).
 */
export function action<S extends z.ZodTypeAny, R>(
  schema: S,
  permission: Permission | Permission[] | null,
  handler: (ctx: AuthContext, input: z.output<S>) => Promise<R>,
): (raw: z.input<S>) => Promise<ActionResult<R>> {
  return async (raw: z.input<S>) => {
    try {
      const ctx = await requireUser();
      if (permission) {
        const perms = Array.isArray(permission) ? permission : [permission];
        if (!perms.some((p) => ctx.permissions.has(p) || ctx.role === "system")) requirePermission(ctx, perms[0]!);
      }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
        throw new AppError("validation", "Please check the highlighted fields.", { fields });
      }
      const data = await handler(ctx, parsed.data);
      return { ok: true, data };
    } catch (err) {
      return toPublicError(err, ({ id, err }) => logger.error({ errorId: id, err }, "action failed"));
    }
  };
}

/** Same wrapper for unauthenticated actions (login, invite acceptance). */
export function publicAction<S extends z.ZodTypeAny, R>(schema: S, handler: (input: z.output<S>) => Promise<R>): (raw: z.input<S>) => Promise<ActionResult<R>> {
  return async (raw: z.input<S>) => {
    try {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
        throw new AppError("validation", "Please check the highlighted fields.", { fields });
      }
      return { ok: true, data: await handler(parsed.data) };
    } catch (err) {
      return toPublicError(err, ({ id, err }) => logger.error({ errorId: id, err }, "public action failed"));
    }
  };
}
