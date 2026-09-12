"use client";
import { useRouter } from "next/navigation";
import { NotebookPen, Pencil, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { editWorkLog, logWork, startWorkTimer, stopWorkTimer } from "@/lib/actions/work";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { WorkStateChip } from "./badges";
import type { WorkLogRow } from "@/lib/dal/work-logs";
import { WORK_STATES, WORK_STATE_LABEL, type WorkState } from "@/lib/domain/types";
import { cn, formatMinutes, relativeTime } from "@/lib/utils";

/**
 * FR-DEV-02 work log panel (design.md §7.11a): headline total, entries newest-first, inline "Log work" row
 * (not a dialog), timer start/stop → minutes prefilled; entries editable by the author for 24 h.
 */
export function WorkLogPanel({ ticketId, total, entries, canWrite, viewerId, runningSince, locked }: { ticketId: string; total: number; entries: WorkLogRow[]; canWrite: boolean; viewerId: string; runningSince: string | null; locked?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<WorkState | "">("");
  const [timerRange, setTimerRange] = useState<{ startedAt: string; endedAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    if (!runningSince) return;
    const id = setInterval(() => setTick(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [runningSince]);
  const elapsed = runningSince ? Math.max(0, Math.floor((tick - new Date(runningSince).getTime()) / 60_000)) : 0;

  const submit = async () => {
    if (minutes === "" || !note.trim()) return;
    setBusy(true);
    const r = await logWork({ ticketId, minutes: Number(minutes), note, workState: state || null, startedAt: timerRange?.startedAt ?? null, endedAt: timerRange?.endedAt ?? null });
    setBusy(false);
    if (!r.ok) return toast({ title: r.message, tone: "error" });
    toast({ title: `Logged ${formatMinutes(Number(minutes))} · total ${formatMinutes(r.data.total)}`, tone: "success" });
    setMinutes("");
    setNote("");
    setState("");
    setTimerRange(null);
    setOpen(false);
    router.refresh();
  };

  return (
    <section aria-labelledby="worklog-h" className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-[var(--shadow-1)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="worklog-h" className="text-overline text-on-surface-variant">
            Work log
          </h2>
          <p className="tabular mt-1 font-heading text-[28px] font-bold leading-none tracking-[-0.015em] text-primary" data-testid="time-total">
            {formatMinutes(total)}
          </p>
        </div>
        {canWrite && !locked ? (
          <div className="flex items-center gap-2">
            {runningSince ? (
              <Button
                variant="outline"
                size="sm"
                data-testid="timer-stop"
                onClick={async () => {
                  const r = await stopWorkTimer({ ticketId });
                  if (!r.ok) return toast({ title: r.message, tone: "error" });
                  setMinutes(r.data.minutes);
                  setTimerRange({ startedAt: r.data.startedAt, endedAt: r.data.endedAt });
                  setOpen(true);
                  router.refresh();
                }}
              >
                <Square strokeWidth={1.75} /> Stop · {elapsed}m
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                data-testid="timer-start"
                onClick={async () => {
                  const r = await startWorkTimer({ ticketId });
                  if (!r.ok) return toast({ title: r.message, tone: "error" });
                  toast({ title: "Timer started" });
                  router.refresh();
                }}
              >
                <Play strokeWidth={1.75} /> Timer
              </Button>
            )}
            <Button size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="log-work">
              <NotebookPen strokeWidth={1.75} /> Log work
            </Button>
          </div>
        ) : null}
      </div>

      {open ? (
        <form
          className="mt-3 flex flex-col gap-2 rounded-md border border-outline-variant/60 bg-surface-container-low p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid grid-cols-[96px_1fr] gap-2">
            <Input type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value === "" ? "" : Number(e.target.value))} placeholder="min" aria-label="Minutes" required className="h-9 tabular" data-testid="worklog-minutes" autoFocus />
            <NativeSelect value={state} onChange={(e) => setState(e.target.value as WorkState | "")} aria-label="Work state" className="h-9">
              <option value="">Keep work state</option>
              {WORK_STATES.map((ws) => (
                <option key={ws} value={ws}>
                  {WORK_STATE_LABEL[ws]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you try / find?" rows={3} aria-label="Note" required data-testid="worklog-note" />
          {timerRange ? <p className="text-body-sm text-on-surface-variant">Prefilled from the timer ({formatMinutes(Number(minutes) || 0)}). Adjust if needed.</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={busy} disabled={minutes === "" || !note.trim()} data-testid="worklog-save">
              Save entry
            </Button>
          </div>
        </form>
      ) : null}

      <ul className="mt-3 divide-y divide-outline-variant/40">
        {entries.length === 0 ? <li className="py-3 text-body-sm text-on-surface-variant">No work logged yet.</li> : null}
        {entries.map((e) => (
          <li key={e.id} className="py-2.5">
            {editing === e.id ? (
              <EditRow entry={e} onDone={() => { setEditing(null); router.refresh(); }} onCancel={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-body-sm">
                  <span className="tabular font-heading font-semibold text-primary">{formatMinutes(e.minutes)}</span>
                  <span className="text-on-surface-variant">{e.userName}</span>
                  <span className="text-on-surface-variant">· {String(e.loggedOn)}</span>
                  <WorkStateChip workState={e.workState} />
                  {e.startedAt ? <span className="text-overline rounded-full bg-surface-container px-1.5 py-0.5 text-on-surface-variant">timer</span> : null}
                  <span className="ml-auto flex items-center gap-1 text-on-surface-variant">
                    {relativeTime(e.createdAt)}
                    {canWrite && e.userId === viewerId && e.editable && !locked ? (
                      <button className={cn("pressable rounded-sm p-0.5 hover:text-primary")} onClick={() => setEditing(e.id)} aria-label="Edit entry" title="Editable for 24 hours">
                        <Pencil className="size-3.5" strokeWidth={1.75} />
                      </button>
                    ) : null}
                  </span>
                </div>
                <p className="text-body-md mt-1 whitespace-pre-wrap text-primary">{e.note}</p>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EditRow({ entry, onDone, onCancel }: { entry: WorkLogRow; onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [minutes, setMinutes] = useState(entry.minutes);
  const [note, setNote] = useState(entry.note);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await editWorkLog({ workLogId: entry.id, minutes, note });
        setBusy(false);
        if (!r.ok) return toast({ title: r.message, tone: "error" });
        toast({ title: "Entry updated", tone: "success" });
        onDone();
      }}
    >
      <Input type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Minutes" className="h-9 w-28 tabular" />
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="Note" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" loading={busy}>Save</Button>
      </div>
    </form>
  );
}
