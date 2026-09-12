import { z } from "zod";

// security.md A10: max lengths on every string, trim, NFC normalisation, reject control characters.
const control = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

export const text = (max: number, min = 1) =>
  z
    .string()
    .transform((s) => s.normalize("NFC").trim())
    .pipe(
      z
        .string()
        .min(min, min === 1 ? "Required" : `At least ${min} characters`)
        .max(max, `At most ${max} characters`)
        .refine((s) => !control.test(s), "Contains invalid characters"),
    );

export const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s == null ? null : s.normalize("NFC").trim()))
    .pipe(
      z
        .string()
        .max(max)
        .refine((s) => !control.test(s), "Contains invalid characters")
        .nullable(),
    )
    .transform((s) => (s === "" ? null : s));

/** Multi-line markdown-lite bodies keep newlines but never other control chars. */
export const markdown = (max: number, min = 1) =>
  z
    .string()
    .transform((s) => s.normalize("NFC").replace(/\r\n/g, "\n").trim())
    .pipe(
      z
        .string()
        .min(min, "Required")
        .max(max, `At most ${max} characters`)
        .refine((s) => !control.test(s), "Contains invalid characters"),
    );

export const optionalMarkdown = (max: number) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s == null ? null : s.normalize("NFC").replace(/\r\n/g, "\n").trim()))
    .pipe(
      z
        .string()
        .max(max)
        .refine((s) => !control.test(s), "Contains invalid characters")
        .nullable(),
    )
    .transform((s) => (s === "" ? null : s));

export const uuid = z.string().uuid();
/** Optional foreign key from a <select>: "" becomes null. */
export const optionalUuid = z.preprocess((v) => (v === "" || v === undefined ? null : v), uuid.nullable());
export const email = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.string().email("Enter a valid email address").max(254));
export const ticketKey = z.string().regex(/^EXP-\d{1,9}$/, "Not a ticket key");
export const password = z.string().min(12, "Use at least 12 characters").max(200);
export const totpCode = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");
export const boundedInt = (min: number, max: number) => z.number().int().min(min).max(max);
