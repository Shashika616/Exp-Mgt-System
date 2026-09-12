import "server-only";
import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { env, isProd } from "@/lib/env";
import type { AuthContext } from "@/lib/authz/policy";

// Single pooled connection per lambda/process (architecture.md §13). The app role is app_rw: RLS applies.
declare global {
  var __expendablesSql: ReturnType<typeof postgres> | undefined;
}

const client =
  globalThis.__expendablesSql ??
  postgres(env.DATABASE_URL, {
    max: isProd ? 1 : 8,
    prepare: false, // works through Supabase's transaction pooler
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
if (!isProd) globalThis.__expendablesSql = client;

export const db = drizzle(client, { schema });
export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = PgTransaction<PostgresJsQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;
export { schema };

/**
 * Run `fn` in a transaction with the RLS session context set for `ctx`
 * (`app.user_id`, `app.org_id`, `app.role`). Every DAL function goes through here — there is no
 * code path that touches business tables without a context.
 */
export async function withContext<T>(ctx: AuthContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.user_id', ${ctx.userId}, true), set_config('app.org_id', ${ctx.orgId}, true), set_config('app.role', ${ctx.role}, true)`,
    );
    return fn(tx);
  });
}

export async function closeDb(): Promise<void> {
  await client.end({ timeout: 5 });
}
