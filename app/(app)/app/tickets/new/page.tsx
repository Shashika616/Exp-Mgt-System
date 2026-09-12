import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { NewTicketForm } from "@/components/tickets/new-ticket-form";
import { DirectoryProvider } from "@/components/tickets/staff-directory";
import { requirePermissionOrRedirect } from "@/lib/auth/require";
import { listCategories } from "@/lib/dal/categories";
import { listClientOrgs } from "@/lib/dal/orgs";
import { listStaff } from "@/lib/dal/users";

export const metadata = { title: "New ticket" };

export default async function NewTicketPage() {
  const ctx = await requirePermissionOrRedirect("app", "ticket.create.on_behalf", "/app/tickets/new");
  const [orgs, staff, categories] = await Promise.all([listClientOrgs(ctx), listStaff(ctx, ["agent", "developer", "lead", "admin"]), listCategories(ctx)]);
  return (
    <DirectoryProvider value={{ staff: staff.filter((s) => s.status === "active").map((s) => ({ id: s.id, fullName: s.fullName, roleId: s.roleId })), categories: categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })), canned: [] }}>
      <Breadcrumbs items={[{ href: "/app", label: "Dashboard" }, { href: "/app/tickets", label: "Tickets" }, { label: "New ticket" }]} />
      <PageHeader title="New ticket on behalf of a client" description="Capture what the client told you; they'll see it in their portal and get the confirmation email." />
      <NewTicketForm orgs={orgs.filter((o) => o.status === "active").map((o) => ({ id: o.id, name: o.name }))} />
    </DirectoryProvider>
  );
}
