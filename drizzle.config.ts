import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  strict: true,
  verbose: true,
  dbCredentials: { url: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL ?? "" },
});
