"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deactivateUserAction, inviteContact, reactivateUserAction } from "@/lib/actions/admin";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { relativeTime } from "@/lib/utils";

type Contact = { id: string; fullName: string; email: string; roleId: string; status: string; lastSeenAt: Date | null };

/** FR-ORG-02: contacts per org with role, invite, deactivate (deactivation revokes sessions immediately). */
export function ContactsTable({ orgId, contacts, canManage }: { orgId: string; contacts: Contact[]; canManage: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ fullName: "", email: "", roleId: "client_user" as "client_user" | "client_admin" });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <div>
      <table className="w-full">
        <thead className="text-overline text-left text-on-surface-variant"><tr><th className="pb-2 font-semibold">Name</th><th className="pb-2 font-semibold">Role</th><th className="pb-2 font-semibold">Status</th><th className="pb-2 font-semibold">Last seen</th>{canManage ? <th /> : null}</tr></thead>
        <tbody className="divide-y divide-outline-variant/40">
          {contacts.map((c) => (
            <tr key={c.id} className="h-11">
              <td><span className="flex items-center gap-2 text-body-md"><Avatar name={c.fullName} size={24} /><span><span className="block">{c.fullName}</span><span className="block text-body-sm text-on-surface-variant">{c.email}</span></span></span></td>
              <td className="text-body-sm">{c.roleId.replace("_", " ")}</td>
              <td className="text-body-sm">{c.status}</td>
              <td className="text-body-sm text-on-surface-variant">{c.lastSeenAt ? relativeTime(c.lastSeenAt) : "never"}</td>
              {canManage ? (
                <td className="text-right">
                  {c.status === "deactivated" ? (
                    <Button size="sm" variant="ghost" onClick={async () => { const r = await reactivateUserAction({ userId: c.id }); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: `${c.fullName} reactivated`, tone: "success" }); router.refresh(); }}>Reactivate</Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={async () => { const r = await deactivateUserAction({ userId: c.id }); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: `${c.fullName} deactivated`, undo: async () => { await reactivateUserAction({ userId: c.id }); router.refresh(); } }); router.refresh(); }}>Deactivate</Button>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {canManage ? <Button className="mt-4" variant="outline" onClick={() => setOpen(true)}>Invite contact</Button> : null}
      <Sheet open={open} onClose={() => setOpen(false)} title="Invite a contact" description="They receive a single-use invitation valid for 7 days." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={busy} onClick={async () => { setBusy(true); const r = await inviteContact({ orgId, ...f }); setBusy(false); if (!r.ok) { setErrors(r.fields ?? {}); return toast({ title: r.message, tone: "error" }); } toast({ title: `Invitation sent to ${f.email}`, tone: "success" }); setOpen(false); setF({ fullName: "", email: "", roleId: "client_user" }); router.refresh(); }}>Send invitation</Button></>}>
        <div className="flex flex-col gap-4">
          <Field label="Full name" required error={errors.fullName}>{(p) => <Input {...p} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} data-autofocus />}</Field>
          <Field label="Email" required error={errors.email}>{(p) => <Input {...p} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
          <Field label="Role" required>{(p) => <NativeSelect {...p} value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value as typeof f.roleId })}><option value="client_user">Client user, own requests</option><option value="client_admin">Client admin, all requests + invite colleagues</option></NativeSelect>}</Field>
        </div>
      </Sheet>
    </div>
  );
}
