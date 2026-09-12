import { readFile } from "node:fs/promises";

export type OutboxEntry = { id: string; to: string; subject: string; html: string; text: string; tag?: string; sentAt: string };

/** Emails written by the `log` email provider in dev/test. */
export async function readOutbox(): Promise<OutboxEntry[]> {
  try {
    const raw = await readFile(".local/outbox.jsonl", "utf8");
    return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as OutboxEntry);
  } catch {
    return [];
  }
}

export async function lastEmailTo(to: string, tag?: string, containing?: string, attempts = 30): Promise<OutboxEntry> {
  for (let i = 0; i < attempts; i++) {
    const all = await readOutbox();
    const m = all.filter((e) => e.to.toLowerCase() === to.toLowerCase() && (!tag || e.tag === tag) && (!containing || e.subject.includes(containing) || e.text.includes(containing))).at(-1);
    if (m) return m;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email to ${to}${tag ? ` (${tag})` : ""}`);
}

export function linkFrom(entry: OutboxEntry, pathPrefix: string): string {
  const m = entry.text.match(new RegExp(`https?://[^\\s]+${pathPrefix}[^\\s]+`));
  if (!m) throw new Error("no link in email");
  return m[0];
}
