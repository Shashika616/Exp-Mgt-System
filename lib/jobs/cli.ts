// pnpm cron [job] — run a job from a system cron / container (own-cloud path). Defaults to "all".
import { loadEnv } from "../../db/load-env";

loadEnv();
const { runJob } = await import("./run");
const { closeDb } = await import("@/lib/dal/db");
const job = (process.argv[2] ?? "all") as Parameters<typeof runJob>[0];
console.log(JSON.stringify(await runJob(job)));
await closeDb();
