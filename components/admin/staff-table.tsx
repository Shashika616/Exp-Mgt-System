"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deactivateUserAction, inviteStaff, reactivateUserAction, resetUserMfa, setRole } from "@/lib/actions/admin";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog, Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { relativeTime } from "@/lib/utils";

type Staff = { id: string; fullName: string; email: string; roleId: string; status: string; mfaEnrolled: boolean; lastSeenAt: Date | null };
const ROLES = ["agent", "developer", "lead", "admin"] as const;

export function StaffTable({ staff, selfId }: { staff: Staff[]; selfId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<Staff | null>(null);
  const [f, setF] = useState({ fullName: "", email: "", roleId: "agent" as (typeof ROLES)[number] });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const act = async (p: Promise<{ ok: boolean; message?: string }>, msg: string) => {
    const r = await p;
    if (!r.ok) return toast({ title: r.message ?? "Failed", tone: "error" });
    toast({ title: msg, tone: "success" });
    router.refresh();
  };
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)} data-testid="invite-staff">Invite staff member</Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-lowest shadow-[var(--shadow-1)]">
        <table className="w-full">
          <thead className="bg-surface-container-low text-overline text-left text-on-surface-variant"><tr><th className="h-9 px-4 font-semibold">Name</th><th className="px-4 font-semibold">Role</th><th className="px-4 font-semibold">Status</th><th className="px-4 font-semibold">MFA</th><th className="px-4 font-semibold">Last seen</th><th /></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="row-comfortable border-b border-outline-variant/40">
                <td className="px-4"><span className="flex items-center gap-2"><Avatar name={s.fullName} size={24} /><span><span className="block text-body-md">{s.fullName}{s.id === selfId ? <span className="text-body-sm text-on-surface-variant"> (you)</span> : null}</span><span className="block text-body-sm text-on-surface-variant">{s.email}</span></span></span></td>
                <td className="px-4">
                  <NativeSelect aria-label={`Role of ${s.fullName}`} value={s.roleId} disabled={s.id === selfId} className="h-8 w-36" onChange={(e) => void act(setRole({ userId: s.id, roleId: e.target.value as (typeof ROLES)[number] }), `Role updated, ${s.fullName} will sign in again`)}>
                    {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
                  </NativeSelect>
                </td>
                <td className="px-4 text-body-sm">{s.status}</td>
                <td className="px-4 text-body-sm">{s.mfaEnrolled ? "enrolled" : (s.roleId === "admin" || s.roleId === "lead") ? <span className="text-warning-fg">required</span> : "-"}</td>
                <td className="px-4 text-body-sm text-on-surface-variant">{s.lastSeenAt ? relativeTime(s.lastSeenAt) : "never"}</td>
                <td className="px-4 text-right">
                  {s.id !== selfId ? (
                    <Menu.Root>
                      <Menu.Trigger className="pressable rounded-md px-2 py-1 text-label text-on-surface-variant hover:bg-surface-container">Actions</Menu.Trigger>
                      <Menu.Content align="end">
                        {s.status === "deactivated" ? <Menu.Item onClick={() => void act(reactivateUserAction({ userId: s.id }), "Reactivated")}>Reactivate</Menu.Item> : <Menu.Item onClick={() => setConfirm(s)}>Deactivate</Menu.Item>}
                        {s.mfaEnrolled ? <Menu.Item onClick={() => void act(resetUserMfa({ userId: s.id }), "MFA reset, they'll enrol again at next sign-in")}>Force MFA reset</Menu.Item> : null}
                      </Menu.Content>
                    </Menu.Root>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Invite a staff member" description="A single-use invitation valid for 7 days is emailed to them." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={busy} data-testid="invite-send" onClick={async () => { setBusy(true); const r = await inviteStaff(f); setBusy(false); if (!r.ok) { setErrors(r.fields ?? {}); return toast({ title: r.message, tone: "error" }); } toast({ title: `Invitation sent to ${f.email}`, tone: "success" }); setOpen(false); setF({ fullName: "", email: "", roleId: "agent" }); router.refresh(); }}>Send invitation</Button></>}>
        <div className="flex flex-col gap-4">
          <Field label="Full name" required error={errors.fullName}>{(p) => <Input {...p} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} data-autofocus />}</Field>
          <Field label="Email" required error={errors.email}>{(p) => <Input {...p} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
          <Field label="Role" required hint="Admins and leads must set up two-factor authentication when they accept.">{(p) => <NativeSelect {...p} value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value as typeof f.roleId })}>{ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}</NativeSelect>}</Field>
        </div>
      </Sheet>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title={`Deactivate ${confirm?.fullName}?`} body="They lose access immediately and are signed out everywhere. You can reactivate later." confirmLabel="Deactivate" onConfirm={async () => { if (!confirm) return; await act(deactivateUserAction({ userId: confirm.id }), `${confirm.fullName} deactivated`); setConfirm(null); }} />
    </>
  );
}
