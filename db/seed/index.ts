// pnpm db:seed — reference data always; demo data unless NODE_ENV=production or SEED_DEMO=0.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadEnv } from "../load-env";

loadEnv();
if (!process.env.NODE_ENV) (process.env as Record<string, string>).NODE_ENV = "development";

const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_ADMIN_URL is required");
const client = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema: await import("@/db/schema") });

const { seedReference } = await import("./reference");
const ref = await seedReference(db);
console.log("reference data seeded");

const wantDemo = process.env.NODE_ENV !== "production" && process.env.SEED_DEMO !== "0";
if (wantDemo) {
  const { hashPassword, encrypt, sha256 } = await import("@/lib/auth/crypto");
  const { seedDemo, DEMO_PASSWORD, DEMO_USERS } = await import("./demo");
  const res = await seedDemo(db, { ...ref, hashPassword, encrypt, sha256 });
  console.log(`demo data seeded (${res.created ?? 0} tickets created)`);
  console.log(`sign in with password "${DEMO_PASSWORD}" as any of: ${Object.values(DEMO_USERS).map((u) => u.email).join(", ")}`);
  console.log("admin/lead TOTP secret (demo only): see db/seed/demo.ts DEMO_TOTP_SECRET");
} else {
  console.log("demo data skipped — create the first admin with: pnpm tsx db/seed/first-admin.ts <email> <name>");
}
await client.end();
