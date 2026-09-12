"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveSlaPolicy } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DEFAULT_CALENDAR, type BusinessCalendar, type DayKey } from "@/lib/domain/sla-calendar";
import { DEFAULT_SLA_TARGETS, type SlaTargets } from "@/lib/domain/sla-timers";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Policy = { id?: string; name: string; calendar: BusinessCalendar; targets: SlaTargets; isDefault: boolean };
const DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function SlaAdmin({ policies }: { policies: Policy[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [sel, setSel] = useState<Policy>(policies[0] ?? { name: "New policy", calendar: DEFAULT_CALENDAR, targets: DEFAULT_SLA_TARGETS, isDefault: false });
  const [busy, setBusy] = useState(false);
  const setTarget = (p: keyof SlaTargets, k: "first_response_min" | "resolution_min" | "calendar", v: string) => setSel((s) => ({ ...s, targets: { ...s.targets, [p]: { ...s.targets[p], [k]: k === "calendar" ? v : v === "" ? null : Number(v) } } }));
  const setDay = (d: DayKey, on: boolean) => setSel((s) => ({ ...s, calendar: { ...s.calendar, hours: { ...s.calendar.hours, [d]: on ? [["09:00", "17:00"]] : [] } } }));
  const setHours = (d: DayKey, i: 0 | 1, v: string) => setSel((s) => ({ ...s, calendar: { ...s.calendar, hours: { ...s.calendar.hours, [d]: [[i === 0 ? v : s.calendar.hours[d][0]?.[0] ?? "09:00", i === 1 ? v : s.calendar.hours[d][0]?.[1] ?? "17:00"]] } } }));
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <ul className="flex flex-col gap-1">
        {policies.map((p) => (
          <li key={p.id}><button onClick={() => setSel(p)} className={cn("pressable w-full rounded-md px-3 py-2 text-left text-label text-on-surface-variant hover:bg-surface-container", sel.id === p.id && "bg-primary-fixed/50 text-primary")}>{p.name}{p.isDefault ? <span className="text-overline ml-2 text-secondary">default</span> : null}</button></li>
        ))}
        <li><Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setSel({ name: "New policy", calendar: DEFAULT_CALENDAR, targets: DEFAULT_SLA_TARGETS, isDefault: false })}>New policy</Button></li>
      </ul>
      <Card>
        <CardHeader eyebrow={sel.id ? "Edit" : "New"} title={sel.name || "Policy"} />
        <form className="flex flex-col gap-6" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await saveSlaPolicy({ id: sel.id, name: sel.name, calendar: sel.calendar, targets: sel.targets, isDefault: sel.isDefault }); setBusy(false); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: "SLA policy saved", tone: "success" }); router.refresh(); }}>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Name" required>{(p) => <Input {...p} value={sel.name} onChange={(e) => setSel({ ...sel, name: e.target.value })} />}</Field>
            <label className="flex items-center gap-2 self-end pb-2 text-body-md"><Checkbox checked={sel.isDefault} onCheckedChange={(c) => setSel({ ...sel, isDefault: !!c })} /> Default for new clients</label>
          </div>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table">
            <table className="w-full min-w-[520px]">
              <thead className="text-overline text-left text-on-surface-variant"><tr><th className="pb-2 font-semibold">Priority</th><th className="pb-2 font-semibold">First response (min)</th><th className="pb-2 font-semibold">Resolution (min)</th><th className="pb-2 font-semibold">Calendar</th></tr></thead>
              <tbody>
                {PRIORITIES.map((p) => (
                  <tr key={p} className="h-12">
                    <td className="text-body-md font-medium">{PRIORITY_LABEL[p]}</td>
                    <td className="pr-3"><Input type="number" min={1} className="h-9 w-28 tabular" value={sel.targets[p].first_response_min} onChange={(e) => setTarget(p, "first_response_min", e.target.value)} aria-label={`${p} first response minutes`} /></td>
                    <td className="pr-3"><Input type="number" min={1} className="h-9 w-28 tabular" value={sel.targets[p].resolution_min ?? ""} onChange={(e) => setTarget(p, "resolution_min", e.target.value)} aria-label={`${p} resolution minutes`} /></td>
                    <td><NativeSelect className="h-9 w-40" value={sel.targets[p].calendar} onChange={(e) => setTarget(p, "calendar", e.target.value)} aria-label={`${p} calendar`}><option value="24x7">24 × 7</option><option value="business">Business hours</option></NativeSelect></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <fieldset>
            <legend className="text-overline mb-2 text-on-surface-variant">Business hours ({sel.calendar.tz})</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {DAYS.map((d) => {
                const span = sel.calendar.hours[d][0];
                return (
                  <div key={d} className="flex items-center gap-2">
                    <label className="flex w-16 items-center gap-2 text-body-md capitalize"><Checkbox checked={!!span} onCheckedChange={(c) => setDay(d, !!c)} /> {d}</label>
                    <Input type="time" className="h-8 w-28" value={span?.[0] ?? "09:00"} disabled={!span} onChange={(e) => setHours(d, 0, e.target.value)} aria-label={`${d} start`} />
                    <span className="text-on-surface-variant">–</span>
                    <Input type="time" className="h-8 w-28" value={span?.[1] ?? "17:00"} disabled={!span} onChange={(e) => setHours(d, 1, e.target.value)} aria-label={`${d} end`} />
                  </div>
                );
              })}
            </div>
          </fieldset>
          <Field label="Holidays" hint="One ISO date per line (YYYY-MM-DD). Public holidays for Sri Lanka to be confirmed by the company.">{(p) => <Textarea {...p} rows={4} value={sel.calendar.holidays.join("\n")} onChange={(e) => setSel({ ...sel, calendar: { ...sel.calendar, holidays: e.target.value.split(/\s+/).filter(Boolean) } })} className="text-mono" />}</Field>
          <Field label="Timezone">{(p) => <Input {...p} value={sel.calendar.tz} onChange={(e) => setSel({ ...sel, calendar: { ...sel.calendar, tz: e.target.value } })} />}</Field>
          <Button type="submit" loading={busy} className="self-start">Save policy</Button>
        </form>
      </Card>
    </div>
  );
}
