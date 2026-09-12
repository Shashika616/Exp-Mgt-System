"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { reviewTicket } from "@/lib/actions/work";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { SubmissionRow } from "@/lib/dal/submissions";
import { RESOLUTION_CODES, RESOLUTION_CODE_LABEL, type ResolutionCode } from "@/lib/domain/types";
import { formatMinutes, relativeTime } from "@/lib/utils";

/**
 * FR-DEV-07 review sheet: left = submission (read-only, teal accent), right = editable client reply prefilled
 * from the proposal + resolution code. Footer: Approve & reply (primary) · Return with notes · Ask client.
 */
export function ReviewSheet({ open, onClose, ticketId, ticketKey, submission, version }: { open: boolean; onClose: () => void; ticketId: string; ticketKey: string; submission: SubmissionRow | null; version: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [reply, setReply] = useState(submission?.proposedReply ?? "");
  const [code, setCode] = useState<ResolutionCode>(submission?.suggestedResolutionCode ?? "fixed");
  const [mode, setMode] = useState<"approve" | "return" | "ask">("approve");
  const [notes, setNotes] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const decide = async () => {
    setBusy(true);
    const decision = mode === "approve" ? ({ outcome: "approved", reply, resolutionCode: code } as const) : mode === "return" ? ({ outcome: "returned", notes } as const) : ({ outcome: "ask_client", question } as const);
    const r = await reviewTicket({ ticketId, decision, expectedVersion: version });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast({ title: r.message, tone: "error" });
    }
    toast({ title: mode === "approve" ? `${ticketKey} resolved — reply sent to the client` : mode === "return" ? "Returned to the developer with notes" : "Question sent to the client", tone: "success" });
    onClose();
    router.refresh();
  };
  if (!submission) return null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      width={720}
      title={`Review ${ticketKey}`}
      description={`Submitted by ${submission.developerName} ${relativeTime(submission.submittedAt)} · ${formatMinutes(submission.timeMinutes)} logged`}
      footer={
        <>
          <Button variant="ghost" onClick={() => setMode("ask")} aria-pressed={mode === "ask"}>Ask client</Button>
          <Button variant="outline" onClick={() => setMode("return")} aria-pressed={mode === "return"} data-testid="review-return-mode">Return with notes</Button>
          <Button variant={mode === "approve" ? "primary" : "outline"} onClick={() => (mode === "approve" ? void decide() : setMode("approve"))} loading={busy && mode === "approve"} data-testid="review-approve">
            Approve & reply
          </Button>
        </>
      }
    >
      <div className="grid gap-4 pb-4 md:grid-cols-2">
        <section className="rounded-lg border-t-4 border-review-border bg-review-bg/40 p-4" aria-label="Submission">
          <dl className="flex flex-col gap-3 text-body-md">
            <div><dt className="text-overline text-on-surface-variant">Findings</dt><dd className="mt-1 whitespace-pre-wrap">{submission.findings}</dd></div>
            <div><dt className="text-overline text-on-surface-variant">Root cause</dt><dd className="mt-1 whitespace-pre-wrap">{submission.rootCause ?? "—"}</dd></div>
            <div><dt className="text-overline text-on-surface-variant">What was changed</dt><dd className="mt-1 whitespace-pre-wrap">{submission.changesMade}</dd></div>
            <div><dt className="text-overline text-on-surface-variant">How it was verified</dt><dd className="mt-1 whitespace-pre-wrap">{submission.verification}</dd></div>
            <div><dt className="text-overline text-on-surface-variant">Suggested code</dt><dd className="mt-1">{submission.suggestedResolutionCode ? RESOLUTION_CODE_LABEL[submission.suggestedResolutionCode] : "—"}</dd></div>
            {submission.timeAdjustReason ? <div><dt className="text-overline text-on-surface-variant">Time adjusted</dt><dd className="mt-1">{submission.timeAdjustReason}</dd></div> : null}
          </dl>
        </section>
        <section className="flex flex-col gap-4" aria-label="Decision">
          {mode === "approve" ? (
            <>
              <Field label="Resolution code" required>
                {(p) => (
                  <NativeSelect {...p} value={code} onChange={(e) => setCode(e.target.value as ResolutionCode)}>
                    {RESOLUTION_CODES.filter((c) => c !== "cancelled_by_client" && c !== "no_response").map((c) => (
                      <option key={c} value={c}>{RESOLUTION_CODE_LABEL[c]}</option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field label="Reply to client" required error={errors.reply} hint="Edit freely — this is sent as the public resolution and stored as the resolution note.">
                {(p) => <Textarea {...p} rows={12} value={reply} onChange={(e) => setReply(e.target.value)} data-autofocus data-testid="review-reply" />}
              </Field>
            </>
          ) : mode === "return" ? (
            <>
              <Field label="Notes for the developer" required error={errors.notes} hint="Appears in the thread as an internal note. The ticket goes back to In progress with the same developer.">
                {(p) => <Textarea {...p} rows={10} value={notes} onChange={(e) => setNotes(e.target.value)} data-autofocus data-testid="review-notes" />}
              </Field>
              <Button variant="outline" onClick={() => void decide()} loading={busy} disabled={!notes.trim()} data-testid="review-return-confirm">Return to developer</Button>
            </>
          ) : (
            <>
              <Field label="Question for the client" required error={errors.question} hint="Sent as a public reply; the ticket waits for the client and stays with the developer.">
                {(p) => <Textarea {...p} rows={10} value={question} onChange={(e) => setQuestion(e.target.value)} data-autofocus />}
              </Field>
              <Button variant="outline" onClick={() => void decide()} loading={busy} disabled={!question.trim()}>Send question</Button>
            </>
          )}
        </section>
      </div>
    </Sheet>
  );
}
