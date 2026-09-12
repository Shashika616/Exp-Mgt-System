// Production bootstrap (security.md A02 "no default accounts"): creates ONE invited admin and prints the
// single-use invitation link. Usage: pnpm tsx db/seed/first-admin.ts admin@company.lk "Full Name"
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { loadEnv } from "../load-env";

loadEnv();
const [email, fullName] = process.argv.slice(2);
if (!email || !fullName) {
  console.error('usage: pnpm tsx db/seed/first-admin.ts <email> "<full name>"');
  process.exit(1);
}
const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!;
const client = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema });
await db.execute(sql`select set_config('app.role','system',true)`);
const { randomToken, sha256 } = await import("@/lib/auth/crypto");
const [staff] = await db.select({ id: schema.organisations.id }).from(schema.organisations).where(eq(schema.organisations.type, "staff")).limit(1);
if (!staff) throw new Error("run pnpm db:seed first");
const [existingAdmin] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.roleId, "admin")).limit(1);
if (existingAdmin) {
  console.error("an admin already exists, invite further admins from the Admin Console");
  process.exit(1);
}
let providerId: string | null = null;
if (process.env.AUTH_PROVIDER === "supabase") {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  providerId = data.user.id;
}
const [user] = await db.insert(schema.users).values({ email, fullName, roleId: "admin", orgId: staff.id, status: "invited", authProviderId: providerId }).returning({ id: schema.users.id });
if (!providerId) await db.update(schema.users).set({ authProviderId: user!.id }).where(eq(schema.users.id, user!.id));
const token = randomToken();
await db.insert(schema.invitations).values({ userId: user!.id, orgId: staff.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) });
console.log(`Invitation for ${email} (valid 7 days, single use):\n${process.env.APP_URL ?? "http://localhost:3000"}/invite/${token}`);
await client.end();
