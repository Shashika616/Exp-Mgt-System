import Link from "next/link";
import { SetPasswordForm } from "@/components/auth/forms";
import { findInvitation } from "@/lib/dal/users";

export const metadata = { title: "Accept invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await findInvitation(token);
  if (!inv || inv.state !== "valid") {
    return (
      <div>
        <h1 className="text-headline-lg">{inv?.state === "used" ? "Invitation already used" : "Invitation expired or invalid"}</h1>
        <p className="text-body-md mt-2 text-on-surface-variant">
          {inv?.state === "used" ? "This invitation has already been accepted. Sign in with your password or request an email link." : "Ask the person who invited you to send a new invitation."}
        </p>
        <Link href="/login" className="text-label mt-6 block text-secondary underline-offset-4 hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }
  return <SetPasswordForm mode="invite" token={token} email={inv.email} orgName={inv.orgName} />;
}
