"use client";
import { Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export type Uploaded = { id: string; fileName: string; sizeBytes: number };

/** Uploads through /api/attachments (server sniffs MIME); returns ids to attach to the comment. */
export function AttachmentPicker({ ticketId, visibility = "public", value, onChange, touch }: { ticketId: string; visibility?: "public" | "internal"; value: Uploaded[]; onChange: (v: Uploaded[]) => void; touch?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (value.length + files.length > 10) return toast({ title: "Up to 10 files per message", tone: "error" });
    setBusy(true);
    const next = [...value];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set("ticketId", ticketId);
      fd.set("visibility", visibility);
      fd.set("file", file);
      const res = await fetch("/api/attachments", { method: "POST", body: fd });
      const json = (await res.json()) as { ok: boolean; data?: Uploaded; message?: string };
      if (json.ok && json.data) next.push(json.data);
      else toast({ title: json.message ?? `Could not upload ${file.name}`, tone: "error" });
    }
    onChange(next);
    setBusy(false);
    if (input.current) input.current.value = "";
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={input} type="file" multiple className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.log,.xlsx,.docx,.zip" onChange={(e) => void upload(e.target.files)} aria-label="Attach files" />
      <Button type="button" variant="ghost" size={touch ? "lg" : "sm"} loading={busy} onClick={() => input.current?.click()}>
        <Paperclip strokeWidth={1.75} /> Attach
      </Button>
      {value.map((a) => (
        <span key={a.id} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-body-sm">
          <span className="max-w-40 truncate">{a.fileName}</span>
          <button type="button" className="text-on-surface-variant hover:text-error" onClick={() => onChange(value.filter((x) => x.id !== a.id))} aria-label={`Remove ${a.fileName}`}>
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </span>
      ))}
    </div>
  );
}
