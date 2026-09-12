import { ProfileForm } from "@/components/admin/profile-form";
import { requireUserOrRedirect } from "@/lib/auth/require";
import { getUser } from "@/lib/dal/users";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const ctx = await requireUserOrRedirect("portal", "/portal/account");
  const me = await getUser(ctx, ctx.userId);
  return (
    <>
      <h1 className="text-headline-lg mb-6">Your account</h1>
      <ProfileForm value={{ fullName: me?.fullName ?? ctx.fullName, email: ctx.email, role: ctx.role, mfaEnrolled: me?.mfaEnrolled ?? false }} />
    </>
  );
}
