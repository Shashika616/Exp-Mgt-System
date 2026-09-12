// DEV ONLY: drops and recreates the public schema, then re-applies migrations. Refuses to run in production.
import postgres from "postgres";
import { loadEnv } from "./load-env";

loadEnv();
if (process.env.NODE_ENV === "production") {
  console.error("refusing to reset a production database");
  process.exit(1);
}
const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_ADMIN_URL is required");
const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql.unsafe("drop schema if exists public cascade; create schema public; drop schema if exists drizzle cascade; drop schema if exists pgboss cascade;");
await sql.unsafe("grant usage on schema public to app_rw;");
await sql.end();
console.log("schema reset — run pnpm db:migrate && pnpm db:seed");
