import { Body, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

// Branded email (requirements.md §8): navy header with the wordmark, plain body, no sensitive content.
const navy = "#002147";
const text = "#000a1e";
const muted = "#44474e";
const blue = "#1470e8";

export function EmailLayout({ preview, title, appUrl, children }: { preview: string; title: string; appUrl: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f8f9fa", fontFamily: "Inter, Arial, Helvetica, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", backgroundColor: "#ffffff", borderRadius: 8, overflow: "hidden", border: "1px solid #c4c6cf" }}>
          <Section style={{ backgroundColor: navy, padding: "20px 24px" }}>
            <Img src={`${appUrl}/brand/expendables-logo.png`} alt="EXPENDABLES { Software Solutions }" width="56" height="56" style={{ display: "block" }} />
          </Section>
          <Section style={{ padding: "24px" }}>
            <Heading as="h1" style={{ color: text, fontSize: 20, lineHeight: "1.3", margin: "0 0 16px", letterSpacing: "-0.01em" }}>
              {title}
            </Heading>
            {children}
          </Section>
          <Hr style={{ borderColor: "#e1e3e4", margin: 0 }} />
          <Section style={{ padding: "16px 24px" }}>
            <Text style={{ color: muted, fontSize: 12, lineHeight: "1.5", margin: 0 }}>
              EXPENDABLES (PVT) LTD · 63 Parakum Mawatha, Gampaha · +94 77 631 5240
              <br />
              You receive this because you have an account on the Expendables support portal.{" "}
              <Link href={`${appUrl}/login`} style={{ color: blue }}>
                Sign in
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  p: { color: text, fontSize: 15, lineHeight: "1.6", margin: "0 0 14px", fontFamily: "'Source Sans 3', Arial, Helvetica, sans-serif" },
  muted: { color: muted, fontSize: 13, lineHeight: "1.5", margin: "0 0 12px" },
  button: {
    display: "inline-block",
    backgroundColor: navy,
    color: "#ffffff",
    padding: "12px 20px",
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textDecoration: "none",
  },
  quote: { borderLeft: `3px solid ${blue}`, paddingLeft: 12, color: text, fontSize: 15, lineHeight: "1.6", margin: "0 0 14px", whiteSpace: "pre-wrap" as const },
};
