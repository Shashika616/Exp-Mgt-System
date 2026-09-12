import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth/session";

export default async function Home() {
  const s = await getSession();
  if (s.kind === "anonymous") redirect("/login");
  if (s.kind === "mfa_enroll_required") redirect("/mfa/enroll");
  if (s.kind === "mfa_required") redirect("/mfa");
  redirect(homeFor(s.ctx));
}
