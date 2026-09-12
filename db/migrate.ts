// Applies db/migrations/*.sql in journal order using Drizzle's migrator.
// Runs with DATABASE_ADMIN_URL (DDL owner) - the app itself uses the least-privilege DATABASE_URL.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { loadEnv } from "./load-env";

loadEnv();

const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_ADMIN_URL (or DATABASE_URL) is required");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("migrations applied");
} finally {
  await sql.end();
}
