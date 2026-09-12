import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

/** Fresh, deterministic database for every e2e run (reset → migrate → seed). */
export default async function globalSetup() {
  if (process.env.E2E_SKIP_DB_RESET) return;
  const env = { ...process.env, NODE_ENV: "test" as const };
  execSync("pnpm db:reset", { stdio: "inherit", env });
  execSync("pnpm db:migrate", { stdio: "inherit", env });
  execSync("pnpm db:seed", { stdio: "inherit", env });
  rmSync(".local/outbox.jsonl", { force: true });
}
