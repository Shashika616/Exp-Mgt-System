"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useTicketLive } from "@/lib/realtime/provider";
import type { TicketDetail } from "@/lib/dal/tickets";
import type { SubmissionRow } from "@/lib/dal/submissions";
import { PropertiesPanel } from "./properties-panel";
import { SubmitReviewSheet } from "./submit-review-sheet";
import { ReviewSheet } from "./review-sheet";
import { firstName } from "@/lib/utils";

type Viewer = { userId: string; role: "agent" | "developer" | "lead" | "admin"; perms: string[] };

/** Client wrapper: realtime refresh + the two sheets (submit / review) opened from the properties panel. */
export function TicketDetailClient({ t, viewer, openSubmission, realtime, children, openReview }: { t: TicketDetail; viewer: Viewer; openSubmission: SubmissionRow | null; realtime: "sse" | "supabase"; children: React.ReactNode; openReview?: boolean }) {
  const router = useRouter();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(!!openReview);
  const refresh = useCallback(() => router.refresh(), [router]);
  useTicketLive(t.id, refresh, realtime);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">{children}</div>
      <div className="lg:sticky lg:top-[calc(var(--topbar-height)+24px)] lg:self-start">
        <PropertiesPanel t={t} viewer={viewer} onSubmitReview={() => setSubmitOpen(true)} onReview={() => setReviewOpen(true)} />
      </div>
      <SubmitReviewSheet key={`submit-${t.version}`} open={submitOpen} onClose={() => setSubmitOpen(false)} ticketId={t.id} loggedMinutes={t.timeSpentMinutes} version={t.version} requesterFirstName={firstName(t.requester.fullName)} />
      <ReviewSheet key={`review-${t.version}-${openSubmission?.id ?? ""}`} open={reviewOpen} onClose={() => setReviewOpen(false)} ticketId={t.id} ticketKey={t.key} submission={openSubmission} version={t.version} />
    </div>
  );
}
