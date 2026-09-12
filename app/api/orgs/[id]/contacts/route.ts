import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { requireAny } from "@/lib/authz/policy";
import { listOrgContacts } from "@/lib/dal/users";
import { logAccessDenied } from "@/lib/dal/audit";

/** Contacts of a client org (for participant pickers). Staff only; RLS + permission check. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireUser();
    requireAny(ctx, ["ticket.participants", "org.read"]);
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ contacts: [] }, { status: 404 });
    // clients may only list their own organisation (RLS would return [] anyway; 404 + audit is the explicit answer)
    if (ctx.orgType === "client" && id !== ctx.orgId) {
      await logAccessDenied(ctx, "organisation", id);
      return NextResponse.json({ contacts: [] }, { status: 404 });
    }
    const contacts = await listOrgContacts(ctx, id);
    return NextResponse.json({ contacts: contacts.filter((c) => c.status === "active").map((c) => ({ id: c.id, fullName: c.fullName, email: c.email })) });
  } catch {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
}
