"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeCanned, saveCanned, saveCategory } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Cat = { id: string; name: string; parentId: string | null; active: boolean; description: string | null };
type Canned = { id: string; title: string; shortcut: string | null; body: string };

export function CategoriesAdmin({ categories, canned }: { categories: Cat[]; canned: Canned[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [c, setC] = useState<{ id?: string; title: string; shortcut: string; body: string }>({ title: "", shortcut: "", body: "" });
  const parents = categories.filter((x) => !x.parentId);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader eyebrow="Taxonomy" title="Categories" />
        <ul className="divide-y divide-outline-variant/40">
          {parents.map((p) => (
            <li key={p.id} className="py-2">
              <div className="flex items-center gap-2">
                <span className={cn("text-body-md flex-1", !p.active && "text-outline line-through")}>{p.name}</span>
                <Button size="sm" variant="ghost" onClick={async () => { const r = await saveCategory({ id: p.id, name: p.name, active: !p.active }); if (!r.ok) return toast({ title: r.message, tone: "error" }); router.refresh(); }}>{p.active ? "Disable" : "Enable"}</Button>
              </div>
              <ul className="ml-4 mt-1 flex flex-wrap gap-1.5">
                {categories.filter((x) => x.parentId === p.id).map((s) => (
                  <li key={s.id} className={cn("rounded-full border border-outline-variant px-2 py-0.5 text-[12px]", !s.active && "text-outline line-through")}>{s.name}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <form className="mt-4 flex flex-col gap-3 rounded-md bg-surface-container-low p-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await saveCategory({ name, parentId: parentId || null }); setBusy(false); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: `Category "${name}" added`, tone: "success" }); setName(""); router.refresh(); }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="New category" required>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} data-testid="category-name" />}</Field>
            <Field label="Parent">{(p) => <NativeSelect {...p} value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">Top level</option>{parents.map((x) => (<option key={x.id} value={x.id}>{x.name}</option>))}</NativeSelect>}</Field>
          </div>
          <Button type="submit" size="sm" loading={busy} disabled={!name.trim()} className="self-start" data-testid="category-save">Add category</Button>
        </form>
      </Card>
      <Card>
        <CardHeader eyebrow="Replies" title="Canned responses" />
        <ul className="divide-y divide-outline-variant/40">
          {canned.map((x) => (
            <li key={x.id} className="flex items-start gap-2 py-2">
              <div className="min-w-0 flex-1"><p className="text-body-md">{x.title} {x.shortcut ? <span className="text-mono text-on-surface-variant">/{x.shortcut}</span> : null}</p><p className="text-body-sm line-clamp-2 text-on-surface-variant">{x.body}</p></div>
              <Button size="sm" variant="ghost" onClick={() => setC({ id: x.id, title: x.title, shortcut: x.shortcut ?? "", body: x.body })}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={async () => { const r = await removeCanned({ id: x.id }); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: "Removed" }); router.refresh(); }}>Remove</Button>
            </li>
          ))}
        </ul>
        <form className="mt-4 flex flex-col gap-3 rounded-md bg-surface-container-low p-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await saveCanned({ ...c, shortcut: c.shortcut || null }); setBusy(false); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: "Saved", tone: "success" }); setC({ title: "", shortcut: "", body: "" }); router.refresh(); }}>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label={c.id ? "Edit response" : "New response"} required>{(p) => <Input {...p} value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} placeholder="Title" />}</Field>
            <Field label="Shortcut">{(p) => <Input {...p} value={c.shortcut} onChange={(e) => setC({ ...c, shortcut: e.target.value })} placeholder="ack" />}</Field>
          </div>
          <Field label="Body" required hint="Placeholders: {{requester.first_name}}, {{ticket.key}}">{(p) => <Textarea {...p} rows={4} value={c.body} onChange={(e) => setC({ ...c, body: e.target.value })} />}</Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={busy} disabled={!c.title.trim() || !c.body.trim()}>{c.id ? "Save changes" : "Add response"}</Button>
            {c.id ? <Button type="button" size="sm" variant="ghost" onClick={() => setC({ title: "", shortcut: "", body: "" })}>Cancel</Button> : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
