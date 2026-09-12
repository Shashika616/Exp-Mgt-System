import Link from "next/link";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePermissionOrRedirect("app", "admin.settings", "/app/admin");
  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <AdminNav />
      <div className="min-w-0">{children}</div>
      <Link href="/app/admin" className="hidden" />
    </div>
  );
}
