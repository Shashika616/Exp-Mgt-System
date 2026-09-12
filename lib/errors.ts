// Uniform error handling (docs/security.md A10). Clients receive a code + generic message + error id - never a stack.
import { randomUUID } from "node:crypto";

export type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "invalid_transition"
  | "rate_limited"
  | "mfa_required"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation: 400,
  conflict: 409,
  invalid_transition: 422,
  rate_limited: 429,
  mfa_required: 403,
  internal: 500,
};

const PUBLIC_MESSAGE: Record<ErrorCode, string> = {
  unauthenticated: "Please sign in to continue.",
  forbidden: "You don't have permission to do that.",
  not_found: "We couldn't find what you're looking for.",
  validation: "Some of the information provided is not valid.",
  conflict: "This item was changed by someone else. Refresh and try again.",
  invalid_transition: "That action isn't available for this ticket right now.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  mfa_required: "Two-factor authentication is required for your role.",
  internal: "Something went wrong on our side. Please try again.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly id: string;
  readonly publicMessage: string;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? PUBLIC_MESSAGE[code]);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.id = randomUUID();
    this.publicMessage = message && code !== "internal" ? message : PUBLIC_MESSAGE[code];
    this.details = details;
  }

  toPublic(): PublicError {
    return { ok: false, code: this.code, message: this.publicMessage, errorId: this.id, fields: this.details?.fields as Record<string, string> | undefined };
  }
}

export type PublicError = {
  ok: false;
  code: ErrorCode;
  message: string;
  errorId: string;
  fields?: Record<string, string>;
};

export type ActionResult<T = undefined> = { ok: true; data: T } | PublicError;

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const notFound = (msg?: string) => new AppError("not_found", msg);
export const forbidden = (msg?: string) => new AppError("forbidden", msg);
export const unauthenticated = () => new AppError("unauthenticated");
export const validation = (msg: string, fields?: Record<string, string>) => new AppError("validation", msg, { fields });
export const conflict = (msg?: string) => new AppError("conflict", msg);
export const invalidTransition = (msg: string) => new AppError("invalid_transition", msg);

/** Convert any thrown value into a PublicError, logging unknown errors with an id. */
export function toPublicError(err: unknown, log?: (e: { id: string; err: unknown }) => void): PublicError {
  if (err instanceof AppError) {
    if (err.code === "internal") log?.({ id: err.id, err });
    return err.toPublic();
  }
  const wrapped = new AppError("internal");
  log?.({ id: wrapped.id, err });
  return wrapped.toPublic();
}
