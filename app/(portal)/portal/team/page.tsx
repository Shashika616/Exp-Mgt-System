import { redirect } from "next/navigation";
import { TeamTable } from "@/components/portal/team-table";
import { requireUserOrRedirect } from "@/lib/auth/require";
import { listOrgContacts } from "@/lib/dal/users";

export const metadata = { title: "Team" };

/** FR-ORG-02 (client side) / golden path 4: client_admin manages their org's contacts. */
export default async function TeamPage() {
  const ctx = await requireUserOrRedirect("portal", "/portal/team");
  if (!ctx.permissions.has("contact.invite")) redirect("/portal");
  const contacts = await listOrgContacts(ctx, ctx.orgId);
  return (
    <>
      <h1 className="text-headline-lg">Your team</h1>
      <p className="text-body-md mb-6 mt-1 text-on-surface-variant">Colleagues who can raise and follow requests for your organisation.</p>
      <TeamTable selfId={ctx.userId} contacts={contacts.map((c) => ({ id: c.id, fullName: c.fullName, email: c.email, roleId: c.roleId, status: c.status }))} />
    </>
  );
}
