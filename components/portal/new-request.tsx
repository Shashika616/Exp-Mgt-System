"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, HelpCircle, Lightbulb, PackagePlus, Rocket, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { createPortalTicket } from "@/lib/actions/portal/tickets";
import { PortalCreateTicketSchema } from "@/lib/schemas/tickets";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { Paperclip, X } from "lucide-react";
import { TICKET_TYPES, TICKET_TYPE_LABEL, TYPE_URGENCY_OPTIONS, type TicketType } from "@/lib/domain/types";
import { cn, formatDateTime } from "@/lib/utils";

type Input = z.input<typeof PortalCreateTicketSchema>;
const ICONS: Record<TicketType, LucideIcon> = { incident: AlertTriangle, service_request: PackagePlus, change_request: Lightbulb, question: HelpCircle, project_enquiry: Rocket };
const URGENCY_HELP: Record<string, string> = { low: "Whenever you can", medium: "This week", high: "Production is down / blocking work" };
const DRAFT_KEY = "exp.portal.draft";

/**
 * FR-CP-01/02/09: type picker → per-type form (only that type's fields), autosave draft, attachments,
 * confirmation screen with the key and the first-response target. On phones the form is a bottom sheet.
 */
export function NewRequest({ categories, followUpOf }: { categories: { id: string; name: string }[]; followUpOf?: { key: string; subject: string; type: TicketType } | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [type, setType] = useState<TicketType | null>(followUpOf?.type ?? null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState<{ id: string; key: string; priority: string; firstResponseDueAt: string | null } | null>(null);
  const [isPhone, setIsPhone] = useState(false);
  const form = useForm<Input>({ resolver: zodResolver(PortalCreateTicketSchema), mode: "onBlur", defaultValues: { type: followUpOf?.type ?? "incident", subject: followUpOf ? `Follow-up: ${followUpOf.subject}` : "", description: "", urgency: "medium", categoryId: null, followUpOf: followUpOf?.key ?? null } });
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setIsPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  // Autosave draft (FR-CP-01)
  useEffect(() => {
    if (followUpOf) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Input> & { type?: TicketType };
        if (d.type) setType(d.type);
        form.reset({ ...form.getValues(), ...d });
      }
    } catch {}
  }, [followUpOf, form]);
  useEffect(() => {
    const sub = form.watch((v) => {
      try {
        if (v.subject || v.description) localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...v, type: type ?? v.type }));
      } catch {}
    });
    return () => sub.unsubscribe();
  }, [form, type]);
  useEffect(() => {
    if (type) {
      form.setValue("type", type);
      const opts = TYPE_URGENCY_OPTIONS[type];
      if (!opts.includes(form.getValues("urgency"))) form.setValue("urgency", opts[opts.length - 1]!);
    }
  }, [type, form]);

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border-t-4 border-secondary-container bg-surface-container-lowest p-8 shadow-[var(--shadow-1)]" role="status" data-testid="request-confirmation">
        <p className="text-overline text-secondary">Request received</p>
        <h1 className="text-headline-lg mt-2">{done.key}</h1>
        <p className="text-body-lg mt-3 text-on-surface-variant">Thanks — we&apos;ve logged your request{done.firstResponseDueAt ? <> and aim to respond by <strong className="text-primary">{formatDateTime(done.firstResponseDueAt)}</strong></> : null}. A confirmation email is on its way.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/portal/tickets/${done.key}`} className="pressable inline-flex h-11 items-center rounded-md bg-primary-container px-5 text-label text-on-primary hover:bg-secondary-container">View request</Link>
          <Link href="/portal" className="pressable inline-flex h-11 items-center rounded-md border-[1.5px] border-primary-container px-5 text-label text-primary-container hover:bg-surface-container-low">Back to my requests</Link>
        </div>
      </div>
    );
  }

  const picker = (
    <div>
      <h1 className="text-headline-lg">What do you need?</h1>
      <p className="text-body-md mt-1 text-on-surface-variant">Choose the closest match — it sets the right form and response target.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {TICKET_TYPES.map((t) => {
          const Icon = ICONS[t];
          return (
            <li key={t}>
              <button type="button" onClick={() => setType(t)} className="pressable soft-lift soft-lift-hover flex w-full items-start gap-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-5 text-left" data-testid={`type-${t}`}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed"><Icon className="size-5" strokeWidth={1.7} aria-hidden /></span>
                <span><span className="text-headline-sm block">{TICKET_TYPE_LABEL[t].portal}</span><span className="text-body-md mt-1 block text-on-surface-variant">{TICKET_TYPE_LABEL[t].help}</span></span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const err = (k: keyof Input) => form.formState.errors[k]?.message as string | undefined;
  const formBody = type ? (
    <form
      id="new-request-form"
      className="flex flex-col gap-5"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const r = await createPortalTicket({ ...values, type });
        if (!r.ok) {
          for (const [k, msg] of Object.entries(r.fields ?? {})) form.setError(k as keyof Input, { message: msg });
          return toast({ title: r.message, tone: "error" });
        }
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
        // Attachments need the ticket id for their private storage path (security.md A08): upload now.
        if (files.length) {
          setUploading(true);
          let failed = 0;
          for (const file of files) {
            const fd = new FormData();
            fd.set("ticketId", r.data.id);
            fd.set("file", file);
            const res = await fetch("/api/attachments", { method: "POST", body: fd });
            if (!res.ok) failed++;
          }
          setUploading(false);
          if (failed) toast({ title: `${failed} file${failed === 1 ? "" : "s"} could not be attached`, body: "You can add them again from the request page.", tone: "error" });
        }
        setDone(r.data);
        router.refresh();
      })}
    >
      <Field label="Subject" required error={err("subject")} hint="One line, like an email subject.">
        {(p) => <Input {...p} touch maxLength={160} {...form.register("subject")} data-autofocus data-testid="subject" />}
      </Field>
      <Field label={type === "project_enquiry" ? "Tell us about the project" : "What's happening?"} required error={err("description")} hint={type === "incident" ? "What you did, what you expected, what happened instead, and since when. Screenshots help." : undefined}>
        {(p) => <Textarea {...p} rows={8} {...form.register("description")} data-testid="description" />}
      </Field>
      {TYPE_URGENCY_OPTIONS[type].length > 1 ? (
        <Field label="How fast do you need this?" required>
          {() => (
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Urgency">
              {TYPE_URGENCY_OPTIONS[type].map((u) => (
                <label key={u} className={cn("pressable flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border px-3 py-2", form.watch("urgency") === u ? "border-secondary-container bg-secondary-fixed/40" : "border-outline-variant")}>
                  <input type="radio" value={u} {...form.register("urgency")} className="accent-[#1470e8]" />
                  <span><span className="text-label block capitalize">{u}</span><span className="text-body-sm block text-on-surface-variant">{URGENCY_HELP[u]}</span></span>
                </label>
              ))}
            </div>
          )}
        </Field>
      ) : null}
      {type !== "project_enquiry" && categories.length ? (
        <Field label="Area (optional)">
          {(p) => (
            <NativeSelect {...p} {...form.register("categoryId")} className="h-11">
              <option value="">Not sure</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </NativeSelect>
          )}
        </Field>
      ) : null}
      <Field label="Attachments" hint="Up to 10 files, 25 MB each — PDF, images, text/CSV, Excel, Word, ZIP.">
        {(p) => (
          <div className="flex flex-col gap-2">
            <input
              id={p.id}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.log,.xlsx,.docx,.zip"
              className="text-body-md file:mr-3 file:h-10 file:rounded-md file:border-[1.5px] file:border-primary-container file:bg-transparent file:px-4 file:text-label file:text-primary-container hover:file:bg-surface-container-low"
              onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])].slice(0, 10))}
              data-testid="attachments"
            />
            {files.length ? (
              <ul className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-body-sm">
                    <Paperclip className="size-3.5 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
                    <span className="max-w-40 truncate">{f.name}</span>
                    <button type="button" className="text-on-surface-variant hover:text-error" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>
                      <X className="size-3.5" strokeWidth={2} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </Field>
    </form>
  ) : null;

  if (!type) return picker;
  const header = (
    <div className="mb-4 flex items-center gap-2">
      <button type="button" onClick={() => setType(null)} className="pressable inline-flex h-9 items-center gap-1 rounded-md px-2 text-label text-secondary hover:bg-surface-container"><ArrowLeft className="size-4" strokeWidth={1.75} /> Change type</button>
    </div>
  );
  if (isPhone) {
    return (
      <>
        {picker}
        <Sheet open onClose={() => setType(null)} side="bottom" title={TICKET_TYPE_LABEL[type].portal} footer={<Button size="lg" type="submit" form="new-request-form" loading={form.formState.isSubmitting || uploading} className="w-full">Send request</Button>}>
          {formBody}
        </Sheet>
      </>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      {header}
      <h1 className="text-headline-lg">{TICKET_TYPE_LABEL[type].portal}</h1>
      <p className="text-body-md mb-6 mt-1 text-on-surface-variant">{TICKET_TYPE_LABEL[type].help}</p>
      {formBody}
      <div className="mt-6 flex justify-end">
        <Button size="lg" type="submit" form="new-request-form" loading={form.formState.isSubmitting || uploading} data-testid="send-request">Send request</Button>
      </div>
    </div>
  );
}
