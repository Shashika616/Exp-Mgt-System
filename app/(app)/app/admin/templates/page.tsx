import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { TemplatesAdmin } from "@/components/admin/templates-admin";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { listTemplates } from "@/lib/dal/categories";

export const metadata = { title: "Email templates" };

/** FR-ADM-04 */
export default async function TemplatesPage() {
  const ctx = await requirePermissionOrRedirect("app", "admin.templates", "/app/admin/templates");
  const templates = await listTemplates(ctx);
  return (
    <>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { href: "/app/admin", label: "Admin" }, { label: "Email templates" }]} />
      <PageHeader title="Email templates" description="Branded (navy header + wordmark). Placeholders are substituted per message; the preview uses sample values." />
      <TemplatesAdmin templates={templates.map((t) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body }))} />
    </>
  );
}
