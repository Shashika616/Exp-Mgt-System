import "server-only";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Idempotency / tracing key */
  tag?: string;
};

/**
 * Transactional email behind a provider interface (architecture.md §1). The company has not chosen a mail
 * client yet, so only the `log` adapter (server log + dev outbox) ships; SES/SMTP/etc. is a one-file adapter.
 */
export interface EmailProvider {
  readonly name: "log" | "smtp";
  send(message: EmailMessage): Promise<{ id: string }>;
}

// Subjects/names go to the API as structured fields; strip newlines to prevent header injection (security.md A05).
export function cleanHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 998);
}

class LogEmailProvider implements EmailProvider {
  readonly name = "log" as const;
  async send(message: EmailMessage) {
    const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info({ email: { id, to: message.to, subject: message.subject, tag: message.tag } }, "email (log provider)");
    if (env.NODE_ENV !== "production") {
      // Dev/test outbox: lets Playwright read magic links. Never enabled in production (env.ts refuses).
      const { appendOutbox } = await import("./outbox");
      await appendOutbox({ id, ...message, sentAt: new Date().toISOString() });
    }
    return { id };
  }
}

let provider: EmailProvider | undefined;
export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  provider = new LogEmailProvider();
  return provider;
}
