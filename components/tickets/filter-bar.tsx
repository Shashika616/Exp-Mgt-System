"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Columns3, Rows3, Search, X } from "lucide-react";
import { useState, useTransition } from "react";
import { saveSavedView, removeSavedView } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Menu, Popover } from "@/components/ui/menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { PRIORITIES, PRIORITY_LABEL, STAFF_STATUS_LABEL, TICKET_STATUSES, TICKET_TYPES, TICKET_TYPE_LABEL, WORK_STATES, WORK_STATE_LABEL } from "@/lib/domain/types";
import { useDirectory } from "./staff-directory";
import { COLUMN_LABEL, DEFAULT_COLUMNS, type Column } from "./ticket-list";
import { cn } from "@/lib/utils";

export type SavedView = { id: string; name: string; query: Record<string, unknown> };
export type QueueTab = { id: string; label: string; count: number };

/** FR-AG-02 filter bar: status/priority/type/client/assignee/category/SLA/date, saved views, column chooser, density. */
export function FilterBar({ queues, savedViews, orgs, columns, density }: { queues: QueueTab[]; savedViews: SavedView[]; orgs: { id: string; name: string }[]; columns: Column[]; density: "comfortable" | "compact" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const dir = useDirectory();
  const [q, setQ] = useState(params.get("q") ?? "");
  const current = params.get("queue") ?? "all_open";

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("cursor");
    start(() => router.push(`${pathname}?${next.toString()}`));
  };
  const activeFilters = ["status", "priority", "type", "orgId", "assignee", "categoryId", "sla", "workState", "q", "tag"].filter((k) => params.get(k));

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1 border-b border-outline-variant/60" role="tablist" aria-label="Queues">
        {queues.map((t) => (
          <button key={t.id} role="tab" aria-selected={current === t.id} onClick={() => set({ queue: t.id, view: null })} className={cn("pressable -mb-px flex h-10 items-center gap-2 border-b-2 border-transparent px-3 text-label text-on-surface-variant hover:text-primary", current === t.id && !params.get("view") && "border-secondary-container text-secondary")}>
            {t.label}
            <span className="tabular rounded-full bg-surface-container px-1.5 py-0.5 text-[11px] text-on-surface-variant">{t.count}</span>
          </button>
        ))}
        {savedViews.map((v) => (
          <button key={v.id} role="tab" aria-selected={params.get("view") === v.id} onClick={() => {
            const next = new URLSearchParams();
            for (const [k, val] of Object.entries(v.query)) if (val != null) next.set(k, Array.isArray(val) ? val.join(",") : String(val));
            next.set("view", v.id);
            start(() => router.push(`${pathname}?${next.toString()}`));
          }} className={cn("pressable -mb-px flex h-10 items-center gap-2 border-b-2 border-transparent px-3 text-label text-on-surface-variant hover:text-primary", params.get("view") === v.id && "border-secondary-container text-secondary")}>
            <Bookmark className="size-3.5" strokeWidth={1.75} aria-hidden /> {v.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q });
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search key or subject" className="h-9 w-56 pl-8" aria-label="Search tickets" />
        </form>
        <MultiSelect label="Status" param="status" options={TICKET_STATUSES.map((s) => [s, STAFF_STATUS_LABEL[s]])} onChange={set} />
        <MultiSelect label="Priority" param="priority" options={PRIORITIES.map((p) => [p, PRIORITY_LABEL[p]])} onChange={set} />
        <MultiSelect label="Type" param="type" options={TICKET_TYPES.map((t) => [t, TICKET_TYPE_LABEL[t].staff])} onChange={set} />
        <NativeSelect aria-label="Client" value={params.get("orgId") ?? ""} onChange={(e) => set({ orgId: e.target.value })} className="h-9 w-44">
          <option value="">Any client</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Assignee" value={params.get("assignee") ?? ""} onChange={(e) => set({ assignee: e.target.value })} className="h-9 w-40">
          <option value="">Any assignee</option>
          <option value="me">Me</option>
          <option value="unassigned">Unassigned</option>
          {dir.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Category" value={params.get("categoryId") ?? ""} onChange={(e) => set({ categoryId: e.target.value })} className="h-9 w-40">
          <option value="">Any category</option>
          {dir.categories.filter((c) => !c.parentId).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="SLA" value={params.get("sla") ?? ""} onChange={(e) => set({ sla: e.target.value })} className="h-9 w-32">
          <option value="">Any SLA</option>
          <option value="at_risk">At risk</option>
          <option value="breached">Breached</option>
          <option value="ok">On track</option>
        </NativeSelect>
        <MultiSelect label="Work state" param="workState" options={WORK_STATES.map((w) => [w, WORK_STATE_LABEL[w]])} onChange={set} />
        {activeFilters.length ? (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); set(Object.fromEntries(activeFilters.map((k) => [k, null]))); }}>
            <X strokeWidth={1.75} /> Clear
          </Button>
        ) : null}
        <span className="flex-1" />
        <NativeSelect aria-label="Sort" value={`${params.get("sort") ?? "updated"}:${params.get("dir") ?? ""}`} onChange={(e) => { const [s, d] = e.target.value.split(":"); set({ sort: s ?? null, dir: d || null }); }} className="h-9 w-40">
          <option value="updated:">Last updated</option>
          <option value="created:desc">Newest</option>
          <option value="created:asc">Oldest</option>
          <option value="priority:asc">Priority</option>
          <option value="due:asc">SLA due</option>
          <option value="key:desc">Key</option>
        </NativeSelect>
        <Popover.Root>
          <Popover.Trigger className="pressable inline-flex h-9 items-center gap-2 rounded-md border border-outline-variant px-3 text-label text-primary hover:bg-surface-container-low" aria-label="Choose columns">
            <Columns3 className="size-4" strokeWidth={1.75} /> Columns
          </Popover.Trigger>
          <Popover.Content align="end">
            <ul className="grid grid-cols-2 gap-1.5">
              {(Object.keys(COLUMN_LABEL) as Column[]).map((c) => (
                <li key={c}>
                  <label className="flex items-center gap-2 text-body-sm">
                    <Checkbox checked={columns.includes(c)} onCheckedChange={(on) => { const next = on ? [...columns, c] : columns.filter((x) => x !== c); set({ cols: next.join(",") === DEFAULT_COLUMNS.join(",") ? null : next.join(",") }); }} /> {COLUMN_LABEL[c]}
                  </label>
                </li>
              ))}
            </ul>
          </Popover.Content>
        </Popover.Root>
        <Button variant="outline" size="sm" className="h-9" onClick={() => set({ density: density === "compact" ? null : "compact" })} aria-pressed={density === "compact"} aria-label="Toggle density">
          <Rows3 strokeWidth={1.75} /> {density === "compact" ? "Compact" : "Comfortable"}
        </Button>
        <Menu.Root>
          <Menu.Trigger className="pressable inline-flex h-9 items-center gap-2 rounded-md border border-outline-variant px-3 text-label text-primary hover:bg-surface-container-low">
            <Bookmark className="size-4" strokeWidth={1.75} /> Views
          </Menu.Trigger>
          <Menu.Content align="end">
            <Menu.Item
              onClick={async () => {
                const name = window.prompt("Name this view");
                if (!name) return;
                const query: Record<string, unknown> = {};
                for (const k of ["queue", "status", "priority", "type", "orgId", "assignee", "categoryId", "sla", "workState", "q", "sort", "dir"]) {
                  const v = params.get(k);
                  if (v) query[k] = v;
                }
                const r = await saveSavedView({ name, query });
                if (r.ok) {
                  toast({ title: `Saved "${name}"`, tone: "success" });
                  router.refresh();
                } else toast({ title: r.message, tone: "error" });
              }}
            >
              Save current filters as view
            </Menu.Item>
            {savedViews.length ? <Menu.Separator /> : null}
            {savedViews.map((v) => (
              <Menu.Item
                key={v.id}
                onClick={async () => {
                  const r = await removeSavedView({ id: v.id });
                  if (r.ok) {
                    toast({ title: `Removed "${v.name}"` });
                    set({ view: null });
                  }
                }}
              >
                Remove “{v.name}”
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Root>
      </div>
      {pending ? <div className="h-0.5 w-full overflow-hidden rounded bg-surface-container-high"><div className="h-full w-1/3 animate-[shimmer_1s_linear_infinite] bg-secondary-container" /></div> : null}
    </div>
  );
}

function MultiSelect({ label, param, options, onChange }: { label: string; param: string; options: [string, string][]; onChange: (p: Record<string, string | null>) => void }) {
  const params = useSearchParams();
  const selected = (params.get(param) ?? "").split(",").filter(Boolean);
  return (
    <Popover.Root>
      <Popover.Trigger className={cn("pressable inline-flex h-9 items-center gap-2 rounded-md border px-3 text-label hover:bg-surface-container-low", selected.length ? "border-secondary-container bg-secondary-fixed/40 text-secondary" : "border-outline-variant text-primary")}>
        {label}
        {selected.length ? <span className="tabular rounded-full bg-secondary-container px-1.5 text-[11px] text-on-secondary">{selected.length}</span> : null}
      </Popover.Trigger>
      <Popover.Content>
        <ul className="flex flex-col gap-1.5">
          {options.map(([value, text]) => (
            <li key={value}>
              <label className="flex items-center gap-2 text-body-sm">
                <Checkbox checked={selected.includes(value)} onCheckedChange={(on) => onChange({ [param]: (on ? [...selected, value] : selected.filter((x) => x !== value)).join(",") })} /> {text}
              </label>
            </li>
          ))}
        </ul>
      </Popover.Content>
    </Popover.Root>
  );
}
