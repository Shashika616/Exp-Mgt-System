import Link from "next/link";
import { Code2, MessageSquareReply, Undo2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/sparkline";
import { EmptyState } from "@/components/ui/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/tickets/badges";
import { StatTile } from "./stat-tile";
import { WORK_STATES, WORK_STATE_LABEL, type WorkState } from "@/lib/domain/types";
import { WORK_STATE_META, TONE_CLASS } from "@/lib/design/status";
import type { developerDashboard } from "@/lib/dal/stats";
import type { myTimeSummary } from "@/lib/dal/work-logs";
import { dueLabel, formatMinutes, relativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Data = Awaited<ReturnType<typeof developerDashboard>>;
type Time = Awaited<ReturnType<typeof myTimeSummary>>;

/** FR-RP-02 - know what to do next. Columns by work_state, returned/blocked/client-replied strips on top. */
export function DeveloperDashboard({ data, time, timer }: { data: Data; time: Time; timer: { key: string; startedAt: string } | null }) {
  const mine = data.mine;
  const returned = mine.filter((t) => t.reviewOutcome === "returned" && t.status === "in_progress");
  const clientReplied = mine.filter((t) => t.lastClientReplyAt && (!t.lastStaffReplyAt || t.lastClientReplyAt > t.lastStaffReplyAt)).sort((a, b) => (b.lastClientReplyAt?.getTime() ?? 0) - (a.lastClientReplyAt?.getTime() ?? 0)).slice(0, 5);
  const dueSoon = mine.filter((t) => t.resDueAt && !t.resPaused && t.status !== "in_review").sort((a, b) => a.resDueAt!.getTime() - b.resDueAt!.getTime()).slice(0, 5);
  const byState = (ws: WorkState) => mine.filter((t) => t.workState === ws && t.status !== "in_review");
  const inReview = mine.filter((t) => t.status === "in_review");
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="My work" value={mine.length} href="/app/tickets?queue=my_work" />
        <StatTile label="Blocked" value={byState("blocked").length} tone={byState("blocked").length ? "danger" : undefined} href="/app/tickets?queue=my_work&workState=blocked" />
        <StatTile label="Returned from review" value={returned.length} tone={returned.length ? "warning" : undefined} />
        <div className="flex h-[96px] flex-col justify-between rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-[var(--shadow-1)]">
          <p className="text-overline text-on-surface-variant">Hours logged</p>
          <div className="flex items-end justify-between gap-2">
            <p>
              <span className="tabular font-heading text-[28px] font-bold leading-none tracking-[-0.015em] text-primary">{(time.today / 60).toFixed(1)}</span>
              <span className="text-body-sm ml-1 text-on-surface-variant">today · {(time.week / 60).toFixed(1)} this week</span>
            </p>
            <Sparkline values={time.days.map((d) => d.minutes)} labels={time.days.map((d) => d.day)} ariaLabel="Minutes logged per day, last 7 days" />
          </div>
        </div>
      </div>

      {(returned.length > 0 || clientReplied.length > 0 || timer) && (
        <div className="grid gap-4 md:grid-cols-2">
          {returned.length > 0 ? (
            <section className="rounded-lg border-l-4 border-warning-border bg-warning-bg/50 p-4">
              <h2 className="text-label flex items-center gap-2 text-warning-fg">
                <Undo2 className="size-4" strokeWidth={1.75} /> Returned from review
              </h2>
              <ul className="mt-2 divide-y divide-warning-border/50">
                {returned.map((t) => (
                  <li key={t.id}>
                    <Link href={`/app/tickets/${t.key}`} className="flex items-center gap-3 py-2 text-body-md hover:underline">
                      <span className="text-mono text-on-surface-variant">{t.key}</span>
                      <span className="min-w-0 flex-1 truncate">{t.subject}</span>
                      <span className="text-body-sm text-on-surface-variant">{t.reviewedAt ? relativeTime(t.reviewedAt) : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {clientReplied.length > 0 ? (
            <section className="rounded-lg border-l-4 border-info-border bg-info-bg/50 p-4">
              <h2 className="text-label flex items-center gap-2 text-info-fg">
                <MessageSquareReply className="size-4" strokeWidth={1.75} /> Client replies awaiting you
              </h2>
              <ul className="mt-2 divide-y divide-info-border/50">
                {clientReplied.map((t) => (
                  <li key={t.id}>
                    <Link href={`/app/tickets/${t.key}`} className="flex items-center gap-3 py-2 text-body-md hover:underline">
                      <span className="text-mono text-on-surface-variant">{t.key}</span>
                      <span className="min-w-0 flex-1 truncate">{t.subject}</span>
                      <span className="text-body-sm text-on-surface-variant">{t.lastClientReplyAt ? relativeTime(t.lastClientReplyAt) : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <section aria-labelledby="mywork">
        <h2 id="mywork" className="text-headline-sm mb-3">
          My work by state
        </h2>
        {mine.length === 0 ? (
          <EmptyState icon={Code2} title="Nothing assigned to you" body="When the admin assigns you a ticket it will appear here, grouped by your work state." />
        ) : (
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[...WORK_STATES.map((ws) => ({ key: ws, label: WORK_STATE_LABEL[ws], tone: WORK_STATE_META[ws].tone, items: byState(ws) })), { key: "in_review", label: "In review", tone: "review" as const, items: inReview }].map((col) => (
              <div key={col.key} className="flex min-h-40 flex-col rounded-lg bg-surface-container-low p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className={cn("text-overline rounded-full border px-2 py-1", TONE_CLASS[col.tone])}>{col.label}</span>
                  <span className="tabular text-body-sm text-on-surface-variant">{col.items.length}</span>
                </div>
                <ul className="flex flex-col gap-2">
                  {col.items.map((t) => (
                    <li key={t.id}>
                      <Link href={`/app/tickets/${t.key}`} className="soft-lift soft-lift-hover block rounded-md border border-outline-variant/40 bg-surface-container-lowest p-3">
                        <p className="text-mono text-on-surface-variant">{t.key}</p>
                        <p className="text-body-md mt-0.5 line-clamp-2 text-primary">{t.subject}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <PriorityBadge priority={t.priority} short />
                          {t.resDueAt && !t.resPaused ? <span className={cn("text-[11px] font-heading font-medium", t.resBreached ? "text-danger-fg" : t.resAtRisk ? "text-warning-fg" : "text-on-surface-variant")}>{dueLabel(t.resDueAt)}</span> : null}
                          {t.timeSpentMinutes ? <span className="tabular text-[11px] font-heading text-on-surface-variant">{formatMinutes(t.timeSpentMinutes)}</span> : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {dueSoon.length ? (
        <Card>
          <CardHeader eyebrow="SLA" title="Due soon" />
          <ul className="divide-y divide-outline-variant/40">
            {dueSoon.map((t) => (
              <li key={t.id}>
                <Link href={`/app/tickets/${t.key}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-container-low">
                  <span className="text-mono w-20 text-on-surface-variant">{t.key}</span>
                  <span className="min-w-0 flex-1 truncate text-body-md">{t.subject}</span>
                  <StatusBadge status={t.status} />
                  <span className={cn("tabular w-32 text-right text-body-sm", t.resBreached ? "text-danger-fg" : t.resAtRisk ? "text-warning-fg" : "text-on-surface-variant")}>{dueLabel(t.resDueAt!)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
