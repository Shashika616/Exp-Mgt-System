import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { StaffTable } from "@/components/admin/staff-table";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { listStaff } from "@/lib/dal/users";

export const metadata = { title: "Staff & roles" };

/** FR-ADM-01 */
export default async function UsersAdminPage() {
  const ctx = await requirePermissionOrRedirect("app", "user.manage", "/app/admin/users");
  const staff = await listStaff(ctx);
  return (
    <>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { href: "/app/admin", label: "Admin" }, { label: "Staff & roles" }]} />
      <PageHeader title="Staff & roles" count={staff.length} description="Invite agents, developers, leads and admins. Admins and leads must use two-factor authentication." />
      <StaffTable staff={staff.map((s) => ({ id: s.id, fullName: s.fullName, email: s.email, roleId: s.roleId, status: s.status, mfaEnrolled: s.mfaEnrolled, lastSeenAt: s.lastSeenAt }))} selfId={ctx.userId} />
    </>
  );
}
