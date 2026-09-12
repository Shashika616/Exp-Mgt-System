"use client";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { useState } from "react";
import { submitTicketForReview } from "@/lib/actions/work";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { RESOLUTION_CODES, RESOLUTION_CODE_LABEL, type ResolutionCode } from "@/lib/domain/types";
import { formatMinutes } from "@/lib/utils";

/** FR-DEV-04 — structured hand-off (requirements §5.4 rule 5). "Submit to admin" is the only navy button. */
export function SubmitReviewSheet({ open, onClose, ticketId, loggedMinutes, version, requesterFirstName }: { open: boolean; onClose: () => void; ticketId: string; loggedMinutes: number; version: number; requesterFirstName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [f, setF] = useState({ findings: "", rootCause: "", changesMade: "", verification: "", suggestedResolutionCode: "fixed" as ResolutionCode, proposedReply: `Hi ${requesterFirstName},\n\n`, timeMinutes: loggedMinutes, timeAdjustReason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | number) => setF((x) => ({ ...x, [k]: v }));
  const adjusted = f.timeMinutes !== loggedMinutes;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      width={560}
      title="Submit for review"
      description="The admin reviews your findings and sends the reply to the client."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Not yet</Button>
          <Button
            loading={busy}
            data-testid="submit-review-confirm"
            onClick={async () => {
              setBusy(true);
              const r = await submitTicketForReview({ ticketId, expectedVersion: version, findings: f.findings, rootCause: f.rootCause || null, changesMade: f.changesMade, verification: f.verification, suggestedResolutionCode: f.suggestedResolutionCode, proposedReply: f.proposedReply, timeMinutes: f.timeMinutes, timeAdjustReason: adjusted ? f.timeAdjustReason : null });
              setBusy(false);
              if (!r.ok) {
                setErrors(r.fields ?? {});
                return toast({ title: r.message, tone: "error" });
              }
              toast({ title: "Submitted to admin for review", tone: "success" });
              onClose();
              router.refresh();
            }}
          >
            Submit to admin
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-4">
        <Field label="Findings" required error={errors.findings} hint="What you observed and reproduced.">
          {(p) => <Textarea {...p} rows={4} value={f.findings} onChange={(e) => set("findings", e.target.value)} data-autofocus data-testid="sub-findings" />}
        </Field>
        <Field label="Root cause" error={errors.rootCause}>
          {(p) => <Textarea {...p} rows={2} value={f.rootCause} onChange={(e) => set("rootCause", e.target.value)} />}
        </Field>
        <Field label="What was changed" required error={errors.changesMade} hint="Include links to commits / PRs.">
          {(p) => <Textarea {...p} rows={3} value={f.changesMade} onChange={(e) => set("changesMade", e.target.value)} data-testid="sub-changes" />}
        </Field>
        <Field label="How it was verified" required error={errors.verification}>
          {(p) => <Textarea {...p} rows={3} value={f.verification} onChange={(e) => set("verification", e.target.value)} data-testid="sub-verification" />}
        </Field>
        <Field label="Suggested resolution code">
          {(p) => (
            <NativeSelect {...p} value={f.suggestedResolutionCode} onChange={(e) => set("suggestedResolutionCode", e.target.value)}>
              {RESOLUTION_CODES.filter((c) => c !== "cancelled_by_client" && c !== "no_response").map((c) => (
                <option key={c} value={c}>{RESOLUTION_CODE_LABEL[c]}</option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <div className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-3 shadow-[var(--shadow-1)]">
          <p className="mb-2 flex items-center gap-2 text-body-sm text-info-fg">
            <Eye className="size-4" strokeWidth={1.75} aria-hidden /> Visible to client after admin approval
          </p>
          <Field label="Proposed reply to client" required error={errors.proposedReply}>
            {(p) => <Textarea {...p} rows={6} value={f.proposedReply} onChange={(e) => set("proposedReply", e.target.value)} className="bg-white" data-testid="sub-reply" />}
          </Field>
        </div>
        <div className="grid grid-cols-[140px_1fr] items-end gap-3">
          <Field label="Total time (minutes)" hint={`Logged: ${formatMinutes(loggedMinutes)}`}>
            {(p) => <Input {...p} type="number" min={0} className="tabular" value={f.timeMinutes} onChange={(e) => set("timeMinutes", Number(e.target.value))} />}
          </Field>
          {adjusted ? (
            <Field label="Why does it differ?" required error={errors.timeAdjustReason}>
              {(p) => <Input {...p} value={f.timeAdjustReason} onChange={(e) => set("timeAdjustReason", e.target.value)} />}
            </Field>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
