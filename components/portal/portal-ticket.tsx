"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Paperclip, RotateCcw, Send, ThumbsUp, XCircle, UserRoundPlus } from "lucide-react";
import { useCallback, useState } from "react";
import { addPortalParticipant, portalTransition, replyToTicket } from "@/lib/actions/portal/tickets";
import { Button } from "@/components/ui/button";
import { Textarea, NativeSelect } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { AttachmentPicker, type Uploaded } from "@/components/tickets/attachment-picker";
import { useTicketLive } from "@/lib/realtime/provider";
import type { PortalTicket } from "@/lib/dal/portal/tickets";
import { cn } from "@/lib/utils";

/** FR-CP-05: reply box, Reopen on resolved, Confirm (close) on resolved, Cancel on new/open, follow-up on closed. */
export function PortalTicketActions({ t, colleagues, realtime }: { t: PortalTicket; colleagues: { id: string; name: string }[]; realtime: "poll" | "supabase" }) {
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenMsg, setReopenMsg] = useState("");
  const refresh = useCallback(() => router.refresh(), [router]);
  useTicketLive(t.id, refresh, realtime);
  const locked = t.status === "closed" || t.status === "cancelled";
  const transition = async (action: "reopen" | "close" | "cancel", extra: { reason?: string; message?: string } = {}) => {
    setBusy(true);
    const r = await portalTransition({ ticketId: t.id, action, expectedVersion: t.version, ...extra });
    setBusy(false);
    if (!r.ok) return toast({ title: r.message, tone: "error" });
    toast({ title: action === "reopen" ? "Request reopened — we'll pick it up again" : action === "close" ? "Thanks for confirming — request closed" : "Request cancelled", tone: "success" });
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-4">
      {t.status === "resolved" ? (
        <div className="rounded-lg border-l-4 border-success-border bg-success-bg/50 p-4" role="region" aria-label="Resolution">
          <p className="text-label text-success-fg">Resolved — does this fix it for you?</p>
          {t.resolutionNote ? <p className="text-body-md mt-2 whitespace-pre-wrap">{t.resolutionNote}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="lg" onClick={() => void transition("close")} loading={busy} data-testid="confirm-close"><ThumbsUp strokeWidth={1.75} /> Yes, close it</Button>
            <Button size="lg" variant="outline" onClick={() => setReopenOpen(true)} data-testid="reopen"><RotateCcw strokeWidth={1.75} /> Not yet — reopen</Button>
          </div>
        </div>
      ) : null}
      {t.status === "closed" ? (
        <div className="rounded-lg border border-outline-variant/60 bg-surface-container-low p-4 text-body-md text-on-surface-variant">
          This request is closed. Need something related? <Link href={`/portal/new?followUpOf=${t.key}`} className="text-label text-secondary hover:underline" data-testid="follow-up">Create a follow-up request</Link>.
        </div>
      ) : null}
      {!locked ? (
        <section className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest shadow-[var(--shadow-1)]" aria-label="Reply">
          <p className="border-b border-outline-variant/40 px-4 py-2 text-body-sm text-on-surface-variant">Your reply goes to the Expendables team working on this request.</p>
          <div className="p-3">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={t.status === "pending_client" ? "Answer the question above to continue…" : "Add details or ask a question…"} aria-label="Reply" data-testid="portal-reply" className="border-0 px-1 shadow-none focus:ring-0" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <AttachmentPicker ticketId={t.id} value={files} onChange={setFiles} touch />
              <Button size="lg" loading={busy} disabled={!body.trim()} data-testid="portal-send" onClick={async () => { setBusy(true); const r = await replyToTicket({ ticketId: t.id, body, attachmentIds: files.map((f) => f.id) }); setBusy(false); if (!r.ok) return toast({ title: r.message, tone: "error" }); setBody(""); setFiles([]); toast({ title: "Reply sent", tone: "success" }); router.refresh(); }}>
                <Send strokeWidth={1.75} /> Send reply
              </Button>
            </div>
          </div>
        </section>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {(t.status === "new" || t.status === "open") ? <Button variant="ghost" onClick={() => setCancelOpen(true)} data-testid="cancel-request"><XCircle strokeWidth={1.75} /> Cancel this request</Button> : null}
        {!locked && colleagues.length ? (
          <label className="flex items-center gap-2 text-body-sm text-on-surface-variant"><UserRoundPlus className="size-4" strokeWidth={1.75} /> Add a colleague
            <NativeSelect aria-label="Add a colleague" className="h-9 w-48" defaultValue="" onChange={async (e) => { if (!e.target.value) return; const r = await addPortalParticipant({ ticketId: t.id, userId: e.target.value }); if (!r.ok) return toast({ title: r.message, tone: "error" }); toast({ title: "Colleague added", tone: "success" }); router.refresh(); }}>
              <option value="">Choose…</option>
              {colleagues.filter((c) => !t.participants.some((p) => p.userId === c.id) && c.id !== t.requesterId).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </NativeSelect>
          </label>
        ) : null}
      </div>
      <ConfirmDialog open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel ${t.key}?`} body="Cancelled requests are final. If you need this later, raise a new request." confirmLabel="Cancel request" loading={busy} onConfirm={async () => { await transition("cancel", { reason: reason || "Cancelled by client" }); setCancelOpen(false); }}>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" rows={2} aria-label="Reason" />
      </ConfirmDialog>
      <ConfirmDialog open={reopenOpen} onClose={() => setReopenOpen(false)} title={`Reopen ${t.key}?`} body="Tell us what's still wrong so the team can pick it up right away." confirmLabel="Reopen" destructive={false} loading={busy} onConfirm={async () => { await transition("reopen", { message: reopenMsg || undefined }); setReopenOpen(false); }}>
        <Textarea value={reopenMsg} onChange={(e) => setReopenMsg(e.target.value)} placeholder="What's still not working?" rows={3} aria-label="What's still not working" data-testid="reopen-message" />
      </ConfirmDialog>
    </div>
  );
}

export function PortalAttachment({ a }: { a: { id: string; fileName: string; sizeBytes: number } }) {
  return (
    <a href={`/api/attachments/${a.id}/download`} className="pressable inline-flex h-9 items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-body-sm" download>
      <Paperclip className="size-4 text-on-surface-variant" strokeWidth={1.75} aria-hidden /><span className="max-w-48 truncate">{a.fileName}</span>
    </a>
  );
}
