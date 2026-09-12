import { redirect } from "next/navigation";
import { TotpForm } from "@/components/auth/forms";
import { beginTotpEnrollment } from "@/lib/actions/auth";
import { getSession, homeFor } from "@/lib/auth/session";

export const metadata = { title: "Set up two-factor authentication" };
export const dynamic = "force-dynamic";

export default async function MfaEnrollPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const s = await getSession();
  if (s.kind === "anonymous") redirect("/login");
  if (s.kind === "authenticated" && !["admin", "lead"].includes(s.ctx.role)) redirect(homeFor(s.ctx));
  const enr = await beginTotpEnrollment({});
  if (!enr.ok) redirect("/login");
  return <TotpForm mode="enroll" next={next} secret={enr.data.secret} uri={enr.data.uri} recoveryCodes={enr.data.recoveryCodes} />;
}
