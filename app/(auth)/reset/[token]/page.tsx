import { SetPasswordForm } from "@/components/auth/forms";
export const metadata = { title: "Choose a new password" };
export default async function ResetTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SetPasswordForm mode="reset" token={token} />;
}
