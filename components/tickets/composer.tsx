"use client";
import { useRouter } from "next/navigation";
import { Eye, Lock, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createStaffComment } from "@/lib/actions/comments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { cn, firstName } from "@/lib/utils";
import { AttachmentPicker, type Uploaded } from "./attachment-picker";
import { useDirectory } from "./staff-directory";

/**
 * FR-AG-04 / FR-DEV-05 composer: tabs *Reply to client* / *Internal note* — visually unmistakable
 * (design.md §12.10). Developers see a "Visible to client" banner with their client-facing display name.
 * Canned responses expand {{requester.first_name}} / {{ticket.key}} placeholders. Ctrl/⌘+Enter sends; R focuses.
 */
export function Composer({
  ticketId,
  ticketKey,
  requesterName,
  viewerName,
  viewerRole,
  canPublic,
  canInternal,
  publicDisabledReason,
  locked,
}: {
  ticketId: string;
  ticketKey: string;
  requesterName: string;
  viewerName: string;
  viewerRole: string;
  canPublic: boolean;
  canInternal: boolean;
  publicDisabledReason?: string | null;
  locked?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { canned, staff } = useDirectory();
  const [mode, setMode] = useState<"public" | "internal">(
    canPublic && !publicDisabledReason ? "public" : "internal",
  );
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const internal = mode === "internal";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        e.key === "r" &&
        !e.metaKey &&
        !e.ctrlKey &&
        t &&
        !["INPUT", "TEXTAREA"].includes(t.tagName) &&
        !t.isContentEditable
      ) {
        e.preventDefault();
        ta.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const mentions = staff
      .filter((s) => body.includes(`@${s.fullName}`))
      .map((s) => s.id);
    const r = await createStaffComment({
      ticketId,
      body,
      visibility: mode,
      attachmentIds: files.map((f) => f.id),
      mentions,
    });
    setBusy(false);
    if (!r.ok) return toast({ title: r.message, tone: "error" });
    setBody("");
    setFiles([]);
    toast({
      title: internal ? "Internal note added" : "Reply sent to the client",
      tone: "success",
    });
    router.refresh();
  };
  const insertCanned = (text: string) =>
    setBody(
      (b) =>
        (b ? `${b}\n\n` : "") +
        text
          .replaceAll("{{requester.first_name}}", firstName(requesterName))
          .replaceAll("{{ticket.key}}", ticketKey),
    );
  if (locked)
    return (
      <p className="rounded-lg border border-outline-variant/60 bg-surface-container-low p-4 text-body-md text-on-surface-variant">
        This ticket is closed. Replies are locked — the client can raise a
        follow-up request.
      </p>
    );

  return (
    <section
      aria-label="Reply"
      className={cn(
        "rounded-lg border shadow-[var(--shadow-1)]",
        internal
          ? "border-warning-border bg-internal-note"
          : "border-outline-variant/60 bg-surface-container-lowest",
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-outline-variant/40 px-2 pt-2">
        <div
          className="flex items-center gap-1"
          role="tablist"
          aria-label="Message type"
        >
          {canPublic ? (
            <button
              role="tab"
              aria-selected={!internal}
              onClick={() => setMode("public")}
              disabled={!!publicDisabledReason}
              className={cn(
                "pressable -mb-px flex h-9 items-center gap-2 border-b-2 border-transparent px-3 text-label text-on-surface-variant disabled:opacity-50",
                !internal && "border-secondary-container text-secondary",
              )}
              title={publicDisabledReason ?? undefined}
            >
              <Send className="size-4" strokeWidth={1.75} /> Reply to client
            </button>
          ) : null}
          {canInternal ? (
            <button
              role="tab"
              aria-selected={internal}
              onClick={() => setMode("internal")}
              className={cn(
                "pressable -mb-px flex h-9 items-center gap-2 border-b-2 border-transparent px-3 text-label text-on-surface-variant",
                internal && "border-warning-fg text-warning-fg",
              )}
            >
              <Lock className="size-4" strokeWidth={1.75} /> Internal note
            </button>
          ) : null}
        </div>
        <span className="flex-1" />
        {canned.length ? (
          <Menu.Root>
            <Menu.Trigger className="pressable mb-1 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-label text-on-surface-variant hover:bg-surface-container">
              <Sparkles className="size-4" strokeWidth={1.75} /> Canned
            </Menu.Trigger>
            <Menu.Content align="end" className="max-h-72 w-72 overflow-y-auto">
              {canned.map((c) => (
                <Menu.Item key={c.id} onClick={() => insertCanned(c.body)}>
                  <span className="truncate">{c.title}</span>
                  {c.shortcut ? (
                    <span className="text-mono ml-auto text-on-surface-variant">
                      /{c.shortcut}
                    </span>
                  ) : null}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Root>
        ) : null}
      </div>
      {!internal ? (
        <p className="flex items-center gap-2 border-b border-outline-variant/40 bg-info-bg/60 px-4 py-1.5 text-body-sm text-info-fg">
          <Eye className="size-4" strokeWidth={1.75} aria-hidden />
          Visible to client · sent as{" "}
          <strong className="font-medium">
            {viewerName}
            {viewerRole === "developer"
              ? ", Engineer, Expendables"
              : ", Expendables"}
          </strong>
        </p>
      ) : (
        <p className="flex items-center gap-2 border-b border-warning-border/60 px-4 py-1.5 text-body-sm text-warning-fg">
          <Lock className="size-4" strokeWidth={1.75} aria-hidden /> Only
          Expendables staff can see internal notes. Mention a colleague with
          @Name.
        </p>
      )}
      <div className="p-3">
        <Textarea
          ref={ta}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void send();
          }}
          placeholder={
            internal
              ? "Write an internal note… (markdown supported)"
              : `Reply to ${firstName(requesterName)}… (markdown supported)`
          }
          className={cn(
            "min-h-28 border-0 bg-transparent px-1 shadow-none focus:ring-0",
            internal && "bg-transparent",
          )}
          aria-label={internal ? "Internal note" : "Reply to client"}
          data-testid="composer"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <AttachmentPicker
            ticketId={ticketId}
            visibility={mode}
            value={files}
            onChange={setFiles}
          />
          <div className="flex items-center gap-2">
            <span className="text-body-sm hidden text-on-surface-variant sm:inline">
              ⌘↵ to send
            </span>
            <Button
              onClick={() => void send()}
              loading={busy}
              disabled={!body.trim()}
              variant={internal ? "outline" : "primary"}
              data-testid="composer-send"
            >
              {internal ? (
                <Lock strokeWidth={1.75} />
              ) : (
                <Send strokeWidth={1.75} />
              )}
              {internal ? "Add note" : "Send reply"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
