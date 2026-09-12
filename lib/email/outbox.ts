import "server-only";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// Dev/test only: JSON-lines outbox the e2e suite reads to follow magic links and invitations.
const FILE = resolve(process.cwd(), ".local/outbox.jsonl");

export type OutboxEntry = { id: string; to: string; subject: string; html: string; text: string; tag?: string; sentAt: string };

export async function appendOutbox(entry: OutboxEntry): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  await appendFile(FILE, JSON.stringify(entry) + "\n", "utf8");
}

export async function readOutbox(): Promise<OutboxEntry[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as OutboxEntry);
  } catch {
    return [];
  }
}
