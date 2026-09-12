"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

/** Running work-timer dot in the top bar (design.md §7.11a) so a developer never forgets it. */
export function TimerIndicator({ ticketKey, startedAt }: { ticketKey: string; startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const mins = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000));
  return (
    <Link href={`/app/tickets/${ticketKey}`} className="pressable flex h-9 items-center gap-2 rounded-md bg-progress-bg px-3 text-label text-progress-fg" aria-live="polite" aria-label={`Timer running on ${ticketKey} for ${mins} minutes`}>
      <span className="pulse-dot size-2 rounded-full bg-progress-fg" aria-hidden />
      <Timer className="size-4" strokeWidth={1.75} aria-hidden />
      <span className="tabular">
        {ticketKey} · {Math.floor(mins / 60) ? `${Math.floor(mins / 60)}h ` : ""}
        {mins % 60}m
      </span>
    </Link>
  );
}
