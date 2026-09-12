// pnpm test:rls — runs db/policies/tests/*.sql with pgTAP (installed in the local container and on Supabase).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { loadEnv } from "../load-env";

loadEnv();
const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_ADMIN_URL is required");
const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql.unsafe("create extension if not exists pgtap");
const dir = join(process.cwd(), "db/policies/tests");
let failed = 0;
let total = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  const body = readFileSync(join(dir, file), "utf8");
  const results = (await sql.unsafe(body).simple()) as unknown as Array<Array<Record<string, string>>>;
  const lines: string[] = [];
  for (const res of results) for (const row of res as Array<Record<string, string>>) for (const v of Object.values(row)) if (typeof v === "string" && /^(ok|not ok|#|\d+\.\.\d+)/.test(v)) lines.push(v);
  for (const l of lines) {
    if (/^not ok/.test(l)) failed++;
    if (/^(ok|not ok)/.test(l)) total++;
    if (/^not ok|^# /.test(l) || process.env.VERBOSE) console.log(`${file}: ${l}`);
  }
}
await sql.end();
console.log(`pgTAP: ${total - failed}/${total} assertions passed`);
process.exit(failed ? 1 : 0);
