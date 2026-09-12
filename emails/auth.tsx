import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles as s } from "./layout";

export type AuthEmailKind = "magic_link" | "password_reset" | "invitation";

const COPY: Record<AuthEmailKind, { subject: string; title: string; intro: string; cta: string; expiry: string }> = {
  magic_link: {
    subject: "Your sign-in link for Expendables Support",
    title: "Sign in to Expendables Support",
    intro: "Use the button below to sign in. The link works once and expires in 15 minutes.",
    cta: "Sign in",
    expiry: "If you didn't request this, you can ignore this email.",
  },
  password_reset: {
    subject: "Reset your Expendables Support password",
    title: "Reset your password",
    intro: "Use the button below to choose a new password. The link works once and expires in 1 hour.",
    cta: "Choose a new password",
    expiry: "If you didn't request this, you can ignore this email — your password is unchanged.",
  },
  invitation: {
    subject: "You've been invited to Expendables Support",
    title: "You're invited",
    intro: "An account has been created for you on the Expendables support portal. Accept the invitation to set your password.",
    cta: "Accept invitation",
    expiry: "The invitation expires in 7 days and can only be used once.",
  },
};

export function AuthEmail({ kind, name, url, appUrl, orgName }: { kind: AuthEmailKind; name: string; url: string; appUrl: string; orgName?: string }) {
  const c = COPY[kind];
  return (
    <EmailLayout preview={c.subject} title={c.title} appUrl={appUrl}>
      <Text style={s.p}>Hi {name},</Text>
      {orgName ? <Text style={s.p}>You&apos;ve been added to <strong>{orgName}</strong>.</Text> : null}
      <Text style={s.p}>{c.intro}</Text>
      <Section style={{ margin: "20px 0" }}>
        <Link href={url} style={s.button}>
          {c.cta}
        </Link>
      </Section>
      <Text style={s.muted}>{c.expiry}</Text>
      <Text style={s.muted}>
        If the button doesn&apos;t work, paste this link into your browser:
        <br />
        {url}
      </Text>
    </EmailLayout>
  );
}

export const authEmailSubject = (kind: AuthEmailKind) => COPY[kind].subject;
