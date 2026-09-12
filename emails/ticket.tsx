import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles as s } from "./layout";

export type TicketEmailProps = {
  subjectLine: string;
  title: string;
  recipientName: string;
  ticketKey: string;
  ticketSubject: string;
  bodyText: string;
  snippet?: string | null;
  ctaLabel: string;
  ctaUrl: string;
  appUrl: string;
};

/** Generic branded ticket notification. `snippet` is a short excerpt of a reply — never the full body (requirements.md §8). */
export function TicketEmail(p: TicketEmailProps) {
  return (
    <EmailLayout preview={p.subjectLine} title={p.title} appUrl={p.appUrl}>
      <Text style={s.p}>Hi {p.recipientName},</Text>
      <Text style={s.p}>{p.bodyText}</Text>
      <Text style={s.muted}>
        <strong style={{ color: "#000a1e" }}>{p.ticketKey}</strong> · {p.ticketSubject}
      </Text>
      {p.snippet ? <Text style={s.quote}>{p.snippet}</Text> : null}
      <Section style={{ margin: "20px 0" }}>
        <Link href={p.ctaUrl} style={s.button}>
          {p.ctaLabel}
        </Link>
      </Section>
      <Text style={s.muted}>You'll need to sign in to view the full request.</Text>
    </EmailLayout>
  );
}
