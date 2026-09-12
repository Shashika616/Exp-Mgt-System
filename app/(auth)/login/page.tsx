import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/forms";
import { getSession, homeFor, safeNext } from "@/lib/auth/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const s = await getSession();
  if (s.kind === "authenticated") redirect(safeNext(next, homeFor(s.ctx)));
  if (s.kind === "mfa_enroll_required") redirect("/mfa/enroll");
  if (s.kind === "mfa_required") redirect(`/mfa${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return <LoginForm next={next} />;
}
