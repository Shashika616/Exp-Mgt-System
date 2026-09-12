import { z } from "zod";
import { email, password, totpCode } from "./common";

export const LoginSchema = z.object({ email, password: z.string().min(1, "Enter your password").max(200), next: z.string().max(500).optional(), rememberMe: z.boolean().optional() }).strict();
export const MagicLinkSchema = z.object({ email, next: z.string().max(500).optional() }).strict();
export const ResetRequestSchema = z.object({ email }).strict();
export const ResetPasswordSchema = z.object({ token: z.string().min(10).max(300), password }).strict();
export const AcceptInviteSchema = z.object({ token: z.string().min(10).max(300), password }).strict();
export const TotpSchema = z.object({ code: totpCode, next: z.string().max(500).optional() }).strict();
export const RecoveryCodeSchema = z.object({ code: z.string().min(6).max(40) }).strict();
