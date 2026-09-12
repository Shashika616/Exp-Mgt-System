import "server-only";
import { asc } from "drizzle-orm";
import { SYSTEM_CONTEXT } from "@/lib/authz/policy";
import { schema, withContext } from "@/lib/dal/db";

export { fillTemplate, templateIdFor, type TemplateVars } from "./template-utils";

/** Admin-editable templates (FR-ADM-04), cached for a minute per server instance. */
let cache: { at: number; map: Map<string, { subject: string; body: string }> } | null = null;

export async function loadTemplates(): Promise<Map<string, { subject: string; body: string }>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.map;
  const rows = await withContext(SYSTEM_CONTEXT, (tx) => tx.select({ id: schema.emailTemplates.id, subject: schema.emailTemplates.subject, body: schema.emailTemplates.body }).from(schema.emailTemplates).orderBy(asc(schema.emailTemplates.id)));
  cache = { at: Date.now(), map: new Map(rows.map((r) => [r.id, { subject: r.subject, body: r.body }])) };
  return cache.map;
}
