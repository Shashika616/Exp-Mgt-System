"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveGlobalSettings } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { DeveloperPublicReply } from "@/lib/domain/types";

type V = { developersCanSelfAssign: boolean; developerPublicReply: DeveloperPublicReply; showTimeToClient: boolean };

export function SettingsForm({ value }: { value: V }) {
  const router = useRouter();
  const { toast } = useToast();
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="max-w-2xl">
      <CardHeader eyebrow="Workflow" title="Developers & clients" />
      <form className="flex flex-col gap-6" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await saveGlobalSettings(v); setBusy(false); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: "Settings saved", tone: "success" }); router.refresh(); }}>
        <Field label="Developer replies to clients" hint="always — developers may reply publicly in the thread (default). after first admin reply — only once the admin has replied. never — developers draft internally; the admin sends.">
          {(p) => (
            <NativeSelect {...p} value={v.developerPublicReply} onChange={(e) => setV({ ...v, developerPublicReply: e.target.value as DeveloperPublicReply })}>
              <option value="always">Always</option>
              <option value="after_first_admin_reply">After the admin's first reply</option>
              <option value="never">Never — admin sends</option>
            </NativeSelect>
          )}
        </Field>
        <label className="flex items-center justify-between gap-4 text-body-md">
          <span><span className="block">Developers can take unassigned tickets</span><span className="text-body-sm text-on-surface-variant">Off by default — dispatch goes through the admin.</span></span>
          <Switch checked={v.developersCanSelfAssign} onCheckedChange={(c) => setV({ ...v, developersCanSelfAssign: c })} aria-label="Developers can self-assign" />
        </label>
        <label className="flex items-center justify-between gap-4 text-body-md">
          <span><span className="block">Show logged time to clients by default</span><span className="text-body-sm text-on-surface-variant">Per-client override on the organisation page.</span></span>
          <Switch checked={v.showTimeToClient} onCheckedChange={(c) => setV({ ...v, showTimeToClient: c })} aria-label="Show time to client" />
        </label>
        <div className="rounded-md border border-outline-variant/60 bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
          Tickets never close automatically. A resolved ticket is closed when the client confirms, or when a staff member closes it.
        </div>
        <Button type="submit" loading={busy} className="self-start">Save settings</Button>
      </form>
    </Card>
  );
}
