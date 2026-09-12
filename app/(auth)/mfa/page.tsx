import { redirect } from "next/navigation";
import { TotpForm } from "@/components/auth/forms";
import { getSession, homeFor } from "@/lib/auth/session";

export const metadata = { title: "Two-factor authentication" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const s = await getSession();
  if (s.kind === "anonymous") redirect("/login");
  if (s.kind === "mfa_enroll_required") redirect("/mfa/enroll");
  if (s.kind === "authenticated") redirect(next ?? homeFor(s.ctx));
  return <TotpForm mode="verify" next={next} />;
}
