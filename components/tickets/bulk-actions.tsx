"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { bulkUpdate } from "@/lib/actions/tickets";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { useStaffDirectory } from "./staff-directory";
import type { z } from "zod";
import type { BulkSchema } from "@/lib/schemas/tickets";

type BulkOp = z.infer<typeof BulkSchema>["op"];

/** FR-AG-03: assign / status / impact on a selection. */
export function BulkActions({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const staff = useStaffDirectory();
  const run = async (op: BulkOp) => {
    setBusy(true);
    const r = await bulkUpdate({ ticketIds: ids, op });
    setBusy(false);
    if (!r.ok) return toast({ title: r.message, tone: "error" });
    toast({ title: `Updated ${r.data.done} ticket${r.data.done === 1 ? "" : "s"}`, body: r.data.failed.length ? `${r.data.failed.length} could not be updated` : undefined, tone: r.data.failed.length ? "error" : "success" });
    onDone();
    router.refresh();
  };
  return (
    <>
      <Menu.Root>
        <Menu.Trigger disabled={busy} className="pressable h-8 rounded-md px-3 text-label text-inverse-on-surface hover:bg-white/10">
          Assign to…
        </Menu.Trigger>
        <Menu.Content align="center" side="top" className="max-h-80 overflow-y-auto">
          <Menu.Item onClick={() => run({ kind: "assign", assigneeId: null })}>Unassign</Menu.Item>
          <Menu.Separator />
          {staff.map((s) => (
            <Menu.Item key={s.id} onClick={() => run({ kind: "assign", assigneeId: s.id })}>
              {s.fullName} <span className="text-body-sm ml-auto text-on-surface-variant">{s.roleId}</span>
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger disabled={busy} className="pressable h-8 rounded-md px-3 text-label text-inverse-on-surface hover:bg-white/10">
          Status…
        </Menu.Trigger>
        <Menu.Content align="center" side="top">
          <Menu.Item onClick={() => run({ kind: "status", action: "acknowledge" })}>Acknowledge (open)</Menu.Item>
          <Menu.Item onClick={() => run({ kind: "status", action: "start" })}>Start (in progress)</Menu.Item>
          <Menu.Item onClick={() => run({ kind: "status", action: "close" })}>Close resolved</Menu.Item>
        </Menu.Content>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger disabled={busy} className="pressable h-8 rounded-md px-3 text-label text-inverse-on-surface hover:bg-white/10">
          Impact…
        </Menu.Trigger>
        <Menu.Content align="center" side="top">
          {(["low", "medium", "high"] as const).map((i) => (
            <Menu.Item key={i} onClick={() => run({ kind: "impact", impact: i })}>
              {i[0]!.toUpperCase() + i.slice(1)}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Root>
    </>
  );
}
