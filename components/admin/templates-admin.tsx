"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveTemplate } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type T = { id: string; name: string; subject: string; body: string };
const SAMPLE: Record<string, string> = { "ticket.key": "EXP-1042", "ticket.subject": "Invoice PDF export fails for LKR amounts > 1M", "ticket.target_response": "Mon 14 Sep, 11:30", "ticket.resolution_note": "We deployed a fix and verified it against your data.", "ticket.priority": "P2 High", "ticket.escalation_level": "1", "requester.first_name": "Sanduni", "agent.first_name": "Nimal", "developer.first_name": "Kasun", "reviewer.first_name": "Dilshan", "comment.snippet": "Tried again and it works for March but not April.", "sla.metric": "first response", "sla.due_at": "Mon 14 Sep, 11:30", "submission.time": "4h 35m", "review.notes": "Please add the negative-amount case.", "user.first_name": "Sanduni", "invite.url": "https://support.example/invite/…" };
const fill = (s: string) => s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => SAMPLE[k] ?? `{{${k}}}`);

export function TemplatesAdmin({ templates }: { templates: T[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [sel, setSel] = useState<T>(templates[0]!);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <ul className="flex flex-col gap-1">
        {templates.map((t) => (
          <li key={t.id}><button onClick={() => setSel(t)} className={cn("pressable w-full rounded-md px-3 py-2 text-left text-label text-on-surface-variant hover:bg-surface-container", sel.id === t.id && "bg-primary-fixed/50 text-primary")} data-testid={`template-${t.id}`}>{t.name}</button></li>
        ))}
      </ul>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader eyebrow={sel.id} title={sel.name} />
          <form className="flex flex-col gap-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await saveTemplate({ id: sel.id, subject: sel.subject, body: sel.body }); setBusy(false); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: "Template saved", tone: "success" }); router.refresh(); }}>
            <Field label="Subject" required>{(p) => <Input {...p} value={sel.subject} onChange={(e) => setSel({ ...sel, subject: e.target.value })} data-testid="template-subject" />}</Field>
            <Field label="Body" required hint="Markdown-lite. Placeholders like {{ticket.key}} are replaced when sent.">{(p) => <Textarea {...p} rows={12} value={sel.body} onChange={(e) => setSel({ ...sel, body: e.target.value })} className="text-mono" />}</Field>
            <Button type="submit" loading={busy} className="self-start" data-testid="template-save">Save template</Button>
          </form>
        </Card>
        <Card className="p-0">
          <div className="rounded-t-lg bg-primary-container px-6 py-4 text-on-primary"><p className="text-overline text-secondary-fixed-dim">Preview</p><p className="text-headline-sm mt-1 uppercase">Expendables</p></div>
          <div className="p-6">
            <p className="text-label mb-3">{fill(sel.subject)}</p>
            <p className="text-body-md whitespace-pre-wrap">{fill(sel.body)}</p>
            <p className="text-body-sm mt-6 border-t border-outline-variant/60 pt-3 text-on-surface-variant">EXPENDABLES (PVT) LTD · 63 Parakum Mawatha, Gampaha · +94 77 631 5240</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
