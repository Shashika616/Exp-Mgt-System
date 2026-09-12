"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { createTicketOnBehalf } from "@/lib/actions/tickets";
import { AgentCreateTicketSchema } from "@/lib/schemas/tickets";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { computePriority } from "@/lib/domain/priority";
import { LEVELS, PRIORITY_LABEL, TICKET_TYPES, TICKET_TYPE_LABEL } from "@/lib/domain/types";
import { useDirectory } from "./staff-directory";

type Input = z.input<typeof AgentCreateTicketSchema>;
type Contact = { id: string; fullName: string; email: string };

/** FR-AG-07: create on behalf of a client - pick org → contact (or create inline), impact + urgency → computed priority. */
export function NewTicketForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const { staff, categories } = useDirectory();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [inline, setInline] = useState(false);
  const form = useForm<Input>({ resolver: zodResolver(AgentCreateTicketSchema), mode: "onBlur", defaultValues: { orgId: orgs[0]?.id ?? "", requesterId: null, newContact: null, type: "incident", subject: "", description: "", urgency: "medium", impact: "medium", categoryId: null, subcategoryId: null, assigneeId: null } });
  const orgId = form.watch("orgId");
  const impact = form.watch("impact") ?? "medium";
  const urgency = form.watch("urgency");
  const categoryId = form.watch("categoryId");
  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/orgs/${orgId}/contacts`).then(async (r) => {
      if (!r.ok) return;
      const j = (await r.json()) as { contacts: Contact[] };
      setContacts(j.contacts);
      form.setValue("requesterId", j.contacts[0]?.id ?? null);
    });
  }, [orgId, form]);
  const err = (k: keyof Input) => form.formState.errors[k]?.message as string | undefined;

  return (
    <form
      className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const r = await createTicketOnBehalf({ ...values, newContact: inline ? values.newContact : null, requesterId: inline ? null : values.requesterId });
        if (!r.ok) {
          for (const [k, msg] of Object.entries(r.fields ?? {})) form.setError(k as keyof Input, { message: msg });
          return toast({ title: r.message, tone: "error" });
        }
        toast({ title: `${r.data.key} created`, tone: "success" });
        router.push(`/app/tickets/${r.data.key}`);
      })}
    >
      <div className="flex flex-col gap-4">
        <Field label="Client" required error={err("orgId")}>
          {(p) => (
            <NativeSelect {...p} {...form.register("orgId")}>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </NativeSelect>
          )}
        </Field>
        {!inline ? (
          <Field label="Contact" required error={err("requesterId")} hint="The client contact who owns this request.">
            {(p) => (
              <div className="flex gap-2">
                <NativeSelect {...p} {...form.register("requesterId")} className="flex-1">
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.fullName} · {c.email}</option>
                  ))}
                </NativeSelect>
                <Button type="button" variant="outline" onClick={() => setInline(true)}>New contact</Button>
              </div>
            )}
          </Field>
        ) : (
          <div className="grid gap-4 rounded-lg border border-outline-variant/60 bg-surface-container-low p-4 sm:grid-cols-2">
            <Field label="Contact name" required error={(form.formState.errors.newContact as { fullName?: { message?: string } } | undefined)?.fullName?.message}>
              {(p) => <Input {...p} {...form.register("newContact.fullName")} />}
            </Field>
            <Field label="Contact email" required error={(form.formState.errors.newContact as { email?: { message?: string } } | undefined)?.email?.message} hint="They'll receive an invitation to the portal.">
              {(p) => <Input {...p} type="email" {...form.register("newContact.email")} />}
            </Field>
            <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setInline(false)}>Choose existing instead</Button>
          </div>
        )}
        <Field label="Type" required>
          {(p) => (
            <NativeSelect {...p} {...form.register("type")}>
              {TICKET_TYPES.map((t) => (
                <option key={t} value={t}>{TICKET_TYPE_LABEL[t].staff}</option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Subject" required error={err("subject")}>
          {(p) => <Input {...p} maxLength={160} {...form.register("subject")} />}
        </Field>
        <Field label="Description" required error={err("description")} hint="Markdown supported. Steps to reproduce, expected vs actual, when it started.">
          {(p) => <Textarea {...p} rows={10} {...form.register("description")} />}
        </Field>
      </div>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-[var(--shadow-1)]">
          <p className="text-overline text-on-surface-variant">Priority</p>
          <p className="text-headline-sm mt-1">{PRIORITY_LABEL[computePriority(impact, urgency)]}</p>
          <p className="text-body-sm text-on-surface-variant">Computed from impact × urgency.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Impact" required>
              {(p) => (
                <NativeSelect {...p} {...form.register("impact")}>
                  {LEVELS.map((l) => (<option key={l} value={l}>{l[0]!.toUpperCase() + l.slice(1)}</option>))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Urgency" required>
              {(p) => (
                <NativeSelect {...p} {...form.register("urgency")}>
                  {LEVELS.map((l) => (<option key={l} value={l}>{l[0]!.toUpperCase() + l.slice(1)}</option>))}
                </NativeSelect>
              )}
            </Field>
          </div>
        </div>
        <Field label="Category">
          {(p) => (
            <NativeSelect {...p} {...form.register("categoryId")}>
              <option value="">-</option>
              {categories.filter((c) => !c.parentId).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Subcategory">
          {(p) => (
            <NativeSelect {...p} {...form.register("subcategoryId")} disabled={!categories.some((c) => c.parentId === categoryId)}>
              <option value="">-</option>
              {categories.filter((c) => c.parentId === categoryId).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Assign to" hint="Assigning a developer starts work immediately.">
          {(p) => (
            <NativeSelect {...p} {...form.register("assigneeId")}>
              <option value="">Leave unassigned</option>
              {staff.map((s) => (<option key={s.id} value={s.id}>{s.fullName} · {s.roleId}</option>))}
            </NativeSelect>
          )}
        </Field>
        <Button type="submit" size="lg" loading={form.formState.isSubmitting} className="mt-2">Create ticket</Button>
      </div>
    </form>
  );
}
