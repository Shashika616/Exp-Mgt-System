import "server-only";
import { render } from "@react-email/render";
import { createElement } from "react";
import { AuthEmail, authEmailSubject, type AuthEmailKind } from "@/emails/auth";
import { TicketEmail, type TicketEmailProps } from "@/emails/ticket";
import { env } from "@/lib/env";

export type Rendered = { subject: string; html: string; text: string };

export async function renderAuthEmail(kind: AuthEmailKind, p: { name: string; url: string; orgName?: string }): Promise<Rendered> {
  const el = createElement(AuthEmail, { kind, appUrl: env.APP_URL, ...p });
  return {
    subject: authEmailSubject(kind),
    html: await render(el),
    text: `${authEmailSubject(kind)}\n\nHi ${p.name},\n\nOpen this link: ${p.url}\n`,
  };
}

export async function renderTicketEmail(p: Omit<TicketEmailProps, "appUrl">): Promise<Rendered> {
  const el = createElement(TicketEmail, { ...p, appUrl: env.APP_URL });
  const text = `${p.title}\n\nHi ${p.recipientName},\n\n${p.bodyText}\n\n${p.ticketKey} · ${p.ticketSubject}\n${p.snippet ? `\n${p.snippet}\n` : ""}\n${p.ctaLabel}: ${p.ctaUrl}\n`;
  return { subject: p.subjectLine, html: await render(el), text };
}
