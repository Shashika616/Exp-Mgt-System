"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deactivateColleague, inviteColleague } from "@/lib/actions/portal/account";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

type C = { id: string; fullName: string; email: string; roleId: string; status: string };

export function TeamTable({ contacts, selfId }: { contacts: C[]; selfId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ fullName: "", email: "", roleId: "client_user" as "client_user" | "client_admin" });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <>
      <ul className="divide-y divide-outline-variant/40 rounded-lg border border-outline-variant/40 bg-surface-container-lowest shadow-[var(--shadow-1)]">
        {contacts.map((c) => (
          <li key={c.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
            <Avatar name={c.fullName} size={32} />
            <span className="min-w-0 flex-1"><span className="block text-body-md">{c.fullName}{c.id === selfId ? " (you)" : ""}</span><span className="block text-body-sm text-on-surface-variant">{c.email} · {c.roleId.replace("_", " ")} · {c.status}</span></span>
            {c.id !== selfId && c.status !== "deactivated" ? <Button size="sm" variant="ghost" onClick={async () => { const r = await deactivateColleague({ userId: c.id }); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: `${c.fullName} no longer has access` }); router.refresh(); }}>Remove access</Button> : null}
          </li>
        ))}
      </ul>
      <Button className="mt-4" size="lg" onClick={() => setOpen(true)} data-testid="invite-colleague">Invite a colleague</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Invite a colleague" description="They get a single-use invitation valid for 7 days." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={busy} data-testid="invite-colleague-send" onClick={async () => { setBusy(true); const r = await inviteColleague(f); setBusy(false); if (!r.ok) { setErrors(r.fields ?? {}); return toast({ title: r.message, tone: "error" }); } toast({ title: `Invitation sent to ${f.email}`, tone: "success" }); setOpen(false); setF({ fullName: "", email: "", roleId: "client_user" }); router.refresh(); }}>Send invitation</Button></>}>
        <div className="flex flex-col gap-4">
          <Field label="Full name" required error={errors.fullName}>{(p) => <Input {...p} touch value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} data-autofocus data-testid="colleague-name" />}</Field>
          <Field label="Work email" required error={errors.email}>{(p) => <Input {...p} touch type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="colleague-email" />}</Field>
          <Field label="Access" required>{(p) => <NativeSelect {...p} className="h-11" value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value as typeof f.roleId })}><option value="client_user">Their own requests</option><option value="client_admin">All requests + manage the team</option></NativeSelect>}</Field>
        </div>
      </Sheet>
    </>
  );
}
