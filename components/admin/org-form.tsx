"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveOrg } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export type OrgFormValue = { id?: string; name: string; tier: "standard" | "priority" | "enterprise"; timezone: string; slaPolicyId: string | null; notes: string | null; status: "active" | "suspended"; showTimeToClient: boolean };

/** FR-ORG-01 - create/edit a client organisation. */
export function OrgForm({ org, policies, onSaved }: { org?: OrgFormValue; policies: { id: string; name: string }[]; onSaved?: (id: string) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [f, setF] = useState<OrgFormValue>(org ?? { name: "", tier: "standard", timezone: "Asia/Colombo", slaPolicyId: policies[0]?.id ?? null, notes: "", status: "active", showTimeToClient: false });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await saveOrg({ ...f, notes: f.notes || null });
        setBusy(false);
        if (!r.ok) {
          setErrors(r.fields ?? {});
          return toast({ title: r.message, tone: "error" });
        }
        toast({ title: org ? "Organisation updated" : "Organisation created", tone: "success" });
        onSaved?.(r.data.id);
        router.refresh();
      }}
    >
      <Field label="Name" required error={errors.name}>{(p) => <Input {...p} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tier" required>{(p) => <NativeSelect {...p} value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value as OrgFormValue["tier"] })}><option value="standard">Standard</option><option value="priority">Priority</option><option value="enterprise">Enterprise</option></NativeSelect>}</Field>
        <Field label="Status" required>{(p) => <NativeSelect {...p} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as OrgFormValue["status"] })}><option value="active">Active</option><option value="suspended">Suspended</option></NativeSelect>}</Field>
      </div>
      <Field label="Timezone" required error={errors.timezone}>{(p) => <Input {...p} value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} />}</Field>
      <Field label="SLA policy" hint="Targets per priority and business-hours calendar.">{(p) => <NativeSelect {...p} value={f.slaPolicyId ?? ""} onChange={(e) => setF({ ...f, slaPolicyId: e.target.value || null })}><option value="">Default policy</option>{policies.map((x) => (<option key={x.id} value={x.id}>{x.name}</option>))}</NativeSelect>}</Field>
      <Field label="Notes">{(p) => <Textarea {...p} rows={3} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
      <label className="flex items-center gap-2 text-body-md"><Checkbox checked={f.showTimeToClient} onCheckedChange={(c) => setF({ ...f, showTimeToClient: !!c })} /> Show logged time to this client</label>
      <Button type="submit" loading={busy} className="self-start">{org ? "Save changes" : "Create organisation"}</Button>
    </form>
  );
}
