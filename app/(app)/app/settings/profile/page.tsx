import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { ProfileForm } from "@/components/admin/profile-form";
import { requireUserOrRedirect } from "@/lib/auth/require";
import { getUser } from "@/lib/dal/users";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const ctx = await requireUserOrRedirect("app", "/app/settings/profile");
  const me = await getUser(ctx, ctx.userId);
  return (
    <>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { label: "Profile" }]} />
      <PageHeader title="Your profile" />
      <ProfileForm value={{ fullName: me?.fullName ?? ctx.fullName, email: ctx.email, role: ctx.role, mfaEnrolled: me?.mfaEnrolled ?? false }} />
    </>
  );
}
