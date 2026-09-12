/** Pure helpers for admin-editable email templates (no server deps — unit-tested). */
export type TemplateVars = Record<string, string | number | null | undefined>;

const KIND_TO_TEMPLATE: Record<string, string> = {
  ticket_created: "ticket_created",
  staff_reply: "staff_reply",
  client_reply: "client_reply",
  status_pending_client: "status_pending_client",
  status_resolved: "status_resolved",
  status_closed: "status_closed",
  assigned: "assigned",
  sla_at_risk: "sla_at_risk",
  sla_breached: "sla_breached",
  submitted_for_review: "submitted_for_review",
  review_returned: "review_returned",
};

export function templateIdFor(kind: string): string | null {
  return KIND_TO_TEMPLATE[kind] ?? null;
}

/** `{{a.b}}` → value; unknown placeholders are removed so nothing leaks a raw token to a client. */
export function fillTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}
