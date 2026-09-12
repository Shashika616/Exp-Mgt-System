import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { CategoriesAdmin } from "@/components/admin/categories-admin";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { listCanned, listCategories } from "@/lib/dal/categories";

export const metadata = { title: "Categories & canned responses" };

/** FR-ADM-02 */
export default async function CategoriesPage() {
  const ctx = await requirePermissionOrRedirect("app", "admin.categories", "/app/admin/categories");
  const [categories, canned] = await Promise.all([listCategories(ctx, true), listCanned(ctx)]);
  return (
    <>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { href: "/app/admin", label: "Admin" }, { label: "Categories & canned" }]} />
      <PageHeader title="Categories & canned responses" description="Taxonomy for tickets and reusable replies with placeholders." />
      <CategoriesAdmin categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, active: c.active, description: c.description }))} canned={canned.map((c) => ({ id: c.id, title: c.title, shortcut: c.shortcut, body: c.body }))} />
    </>
  );
}
