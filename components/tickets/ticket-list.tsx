"use client";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { PriorityBadge, SlaBadge, StatusBadge, WorkStateChip } from "./badges";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { fadeReduced, springDefault } from "@/lib/design/motion";
import type { TicketListRow } from "@/lib/dal/tickets";
import { TICKET_TYPE_LABEL } from "@/lib/domain/types";
import { cn, relativeTime } from "@/lib/utils";

export type Column = "key" | "subject" | "status" | "priority" | "type" | "client" | "requester" | "assignee" | "category" | "sla" | "updated" | "created" | "time";
export const DEFAULT_COLUMNS: Column[] = ["key", "subject", "status", "priority", "client", "assignee", "sla", "updated"];
export const COLUMN_LABEL: Record<Column, string> = { key: "Key", subject: "Subject", status: "Status", priority: "Priority", type: "Type", client: "Client", requester: "Requester", assignee: "Assignee", category: "Category", sla: "SLA", updated: "Updated", created: "Created", time: "Time" };

/**
 * FR-AG-02 data table: whole row opens the ticket; J/K move, Enter opens, X selects; checkbox on hover/focus;
 * comfortable 44px / compact 36px; bulk bar slides up from the bottom when rows are selected.
 */
export function TicketList({ rows, columns = DEFAULT_COLUMNS, compact = false, embedded = false, selectable = false, onSelectionChange, selected: selectedProp, hrefFor }: { rows: TicketListRow[]; columns?: Column[]; compact?: boolean; embedded?: boolean; selectable?: boolean; onSelectionChange?: (ids: string[]) => void; selected?: string[]; hrefFor?: (r: TicketListRow) => string }) {
  const router = useRouter();
  const [active, setActive] = useState<number>(-1);
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const selected = selectedProp ?? internalSelected;
  const setSelected = useCallback(
    (ids: string[]) => {
      setInternalSelected(ids);
      onSelectionChange?.(ids);
    },
    [onSelectionChange],
  );
  const tableRef = useRef<HTMLTableElement>(null);
  const href = useCallback((r: TicketListRow) => hrefFor?.(r) ?? `/app/tickets/${r.key}`, [hrefFor]);

  useEffect(() => {
    if (embedded) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || target.closest("[role=dialog]"))) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(rows.length - 1, a + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter" && active >= 0 && rows[active]) {
        router.push(href(rows[active]!));
      } else if (e.key === "x" && selectable && active >= 0 && rows[active]) {
        const id = rows[active]!.id;
        setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, active, router, selectable, selected, setSelected, embedded, href]);

  useEffect(() => {
    if (active < 0) return;
    const row = tableRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    row?.scrollIntoView({ block: "nearest" });
    row?.focus({ preventScroll: true });
  }, [active]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const cols = useMemo(() => columns, [columns]);
  if (rows.length === 0) return <EmptyState icon={Inbox} title="No tickets here" body="Nothing matches this view right now." className={embedded ? "m-6" : undefined} />;

  return (
    <div className={cn(!embedded && "overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-lowest shadow-[var(--shadow-1)]")}>
      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full min-w-[720px] border-collapse">
          <thead className="bg-surface-container-low">
            <tr className="text-overline text-left text-on-surface-variant">
              {selectable ? (
                <th className="w-10 px-3">
                  <Checkbox checked={allSelected} onCheckedChange={(c) => setSelected(c ? rows.map((r) => r.id) : [])} aria-label="Select all" />
                </th>
              ) : null}
              {cols.map((c) => (
                <th key={c} className={cn("h-9 whitespace-nowrap px-3 font-semibold", c === "subject" && "w-full", (c === "updated" || c === "created" || c === "time") && "text-right")}>
                  {COLUMN_LABEL[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isSel = selected.includes(r.id);
              return (
                <tr
                  key={r.id}
                  data-index={i}
                  tabIndex={0}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-stop]")) return;
                    router.push(href(r));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(href(r));
                  }}
                  onFocus={() => setActive(i)}
                  className={cn(
                    "group cursor-pointer border-b border-outline-variant/40 outline-none transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low",
                    compact ? "row-compact" : "row-comfortable",
                    (isSel || i === active) && "bg-primary-fixed/40 shadow-[inset_2px_0_0_var(--secondary-container)]",
                  )}
                  aria-selected={isSel || undefined}
                >
                  {selectable ? (
                    <td className="px-3" data-stop>
                      <div className={cn("transition-opacity", !isSel && "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100")}>
                        <Checkbox checked={isSel} onCheckedChange={(c) => setSelected(c ? [...selected, r.id] : selected.filter((x) => x !== r.id))} aria-label={`Select ${r.key}`} />
                      </div>
                    </td>
                  ) : null}
                  {cols.map((c) => (
                    <td key={c} className={cn("px-3 align-middle", c !== "subject" && "whitespace-nowrap", c === "subject" && "max-w-0", (c === "updated" || c === "created" || c === "time") && "text-right")}>
                      <Cell col={c} r={r} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectable ? <BulkBar count={selected.length} onClear={() => setSelected([])} ids={selected} /> : null}
    </div>
  );
}

function Cell({ col, r }: { col: Column; r: TicketListRow }) {
  switch (col) {
    case "key":
      return <span className="text-mono whitespace-nowrap text-on-surface-variant">{r.key}</span>;
    case "subject":
      return (
        <div className="min-w-0">
          <p className="text-body-md truncate text-primary">{r.subject}</p>
          <p className="text-body-sm truncate text-on-surface-variant md:hidden">{r.orgName}</p>
        </div>
      );
    case "status":
      return (
        <span className="flex items-center gap-1.5">
          <StatusBadge status={r.status} />
          <WorkStateChip workState={r.workState} />
          {r.escalationLevel > 0 ? <span className="text-overline rounded-full bg-danger-bg px-1.5 py-0.5 text-danger-fg">L{r.escalationLevel}</span> : null}
        </span>
      );
    case "priority":
      return <PriorityBadge priority={r.priority} short />;
    case "type":
      return <span className="text-body-sm text-on-surface-variant">{TICKET_TYPE_LABEL[r.type].staff}</span>;
    case "client":
      return <span className="text-body-sm truncate text-on-surface-variant">{r.orgName}</span>;
    case "requester":
      return <span className="text-body-sm truncate text-on-surface-variant">{r.requesterName}</span>;
    case "assignee":
      return r.assigneeName ? (
        <span className="flex items-center gap-2 text-body-sm text-primary">
          <Avatar name={r.assigneeName} size={24} /> <span className="truncate">{r.assigneeName}</span>
        </span>
      ) : (
        <span className="text-body-sm italic text-outline">Unassigned</span>
      );
    case "category":
      return <span className="text-body-sm text-on-surface-variant">{r.categoryName ?? "—"}</span>;
    case "sla":
      return (
        <span className="flex flex-wrap gap-1">
          {r.frState !== "none" && !["met", "met_late"].includes(r.frState) ? <SlaBadge state={r.frState} dueAt={r.frDueAt} metric="first_response" /> : null}
          {r.resState !== "none" ? <SlaBadge state={r.resState} dueAt={r.resDueAt} metric="resolution" /> : null}
        </span>
      );
    case "updated":
      return <span className="tabular whitespace-nowrap text-body-sm text-on-surface-variant" title={new Date(r.updatedAt).toLocaleString()}>{relativeTime(r.updatedAt)}</span>;
    case "created":
      return <span className="tabular whitespace-nowrap text-body-sm text-on-surface-variant">{relativeTime(r.createdAt)}</span>;
    case "time":
      return <span className="tabular text-body-sm text-on-surface-variant">{r.timeSpentMinutes ? `${Math.round(r.timeSpentMinutes / 6) / 10}h` : "—"}</span>;
  }
}

function BulkBar({ count, onClear, ids }: { count: number; onClear: () => void; ids: string[] }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {count > 0 ? (
        <m.div initial={reduced ? { opacity: 0 } : { y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduced ? { opacity: 0 } : { y: 24, opacity: 0 }} transition={reduced ? fadeReduced : springDefault} className="fixed inset-x-0 bottom-16 z-30 flex justify-center px-4 md:bottom-6 md:pl-[var(--sidebar-current,var(--sidebar-width))]" role="region" aria-label="Bulk actions">
          <div className="flex items-center gap-2 rounded-lg bg-inverse-surface px-4 py-2 text-inverse-on-surface shadow-[var(--shadow-2)]">
            <span className="tabular text-label">{count} selected</span>
            <BulkActions ids={ids} onDone={onClear} />
            <Button variant="ghost" size="sm" className="text-inverse-on-surface hover:bg-white/10" onClick={onClear}>
              Clear
            </Button>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

import { BulkActions } from "./bulk-actions";
