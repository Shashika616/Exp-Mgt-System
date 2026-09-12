"use client";
import { useRouter } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Building2, Inbox, Plus, Search, Ticket } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { globalSearch } from "@/lib/actions/notifications";
import { fadeReduced, springDefault } from "@/lib/design/motion";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { STATUS_META } from "@/lib/design/status";
import { STAFF_STATUS_LABEL, type Priority, type TicketStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Result = { id: string; kind: "ticket" | "org" | "action"; label: string; sub?: string; href: string; status?: TicketStatus; priority?: Priority };

const ACTIONS: Result[] = [
  { id: "a-new", kind: "action", label: "New ticket on behalf of a client", href: "/app/tickets/new" },
  { id: "a-unassigned", kind: "action", label: "Go to unassigned queue", href: "/app/tickets?queue=unassigned" },
  { id: "a-mine", kind: "action", label: "Go to my tickets", href: "/app/tickets?queue=mine" },
  { id: "a-review", kind: "action", label: "Go to review queue", href: "/app/review" },
  { id: "a-clients", kind: "action", label: "Go to clients", href: "/app/clients" },
];

/** docs/design.md §7.8 — ⌘K: tickets by key/subject/body, clients, actions. 640px, grows from top-centre. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const reduced = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setActive(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await globalSearch({ q: term });
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) return;
      setResults([
        ...r.data.tickets.map((t) => ({ id: t.id, kind: "ticket" as const, label: t.subject, sub: `${t.key} · ${t.orgName}`, href: `/app/tickets/${t.key}`, status: t.status, priority: t.priority })),
        ...r.data.orgs.map((o) => ({ id: o.id, kind: "org" as const, label: o.name, href: `/app/clients/${o.id}` })),
      ]);
      setActive(0);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const actions = term ? ACTIONS.filter((a) => a.label.toLowerCase().includes(term)) : ACTIONS;
    return [...results, ...actions];
  }, [results, q]);

  const go = (r: Result) => {
    onClose();
    router.push(r.href);
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <m.div key="scrim" className="fixed inset-0 z-40 bg-[var(--scrim)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduced ? fadeReduced : springDefault} onClick={onClose} aria-hidden />
          <div className="fixed inset-x-0 top-[12vh] z-50 flex justify-center px-4">
            <m.div
              role="dialog"
              aria-modal="true"
              aria-label="Search"
              className="w-full max-w-[640px] origin-top rounded-lg bg-surface-container-lowest shadow-[var(--shadow-2)]"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
              transition={reduced ? fadeReduced : springDefault}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(list.length - 1, a + 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                }
                if (e.key === "Enter" && list[active]) {
                  e.preventDefault();
                  go(list[active]!);
                }
              }}
            >
              <div className="flex items-center gap-3 border-b border-outline-variant/60 px-4">
                <Search className="size-5 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
                <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tickets, clients, actions…" className="h-12 flex-1 bg-transparent text-body-lg text-primary outline-none placeholder:text-outline" aria-label="Search" role="combobox" aria-expanded aria-controls="palette-list" aria-activedescendant={list[active] ? `palette-${list[active].id}` : undefined} />
                <Kbd>esc</Kbd>
              </div>
              <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1">
                {loading && list.length === results.length + ACTIONS.length ? null : null}
                {list.length === 0 ? <li className="px-3 py-8 text-center text-body-sm text-on-surface-variant">{loading ? "Searching…" : "No matches"}</li> : null}
                {list.map((r, i) => {
                  const Icon = r.kind === "ticket" ? Ticket : r.kind === "org" ? Building2 : r.href.includes("new") ? Plus : Inbox;
                  return (
                    <li
                      key={r.id}
                      id={`palette-${r.id}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        go(r);
                      }}
                      className={cn("flex h-10 cursor-default items-center gap-3 rounded-md px-3", i === active && "bg-surface-container-low")}
                    >
                      <Icon className="size-4 shrink-0 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-body-md text-primary">{r.label}</span>
                      {r.sub ? <span className="text-body-sm truncate text-on-surface-variant">{r.sub}</span> : null}
                      {r.status ? (
                        <Badge tone={STATUS_META[r.status].tone} dot>
                          {STAFF_STATUS_LABEL[r.status]}
                        </Badge>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </m.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
