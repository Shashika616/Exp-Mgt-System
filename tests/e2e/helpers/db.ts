import postgres from "postgres";

/** Direct DB access for test setup/assertions (admin URL, bypasses RLS on purpose). */
export function adminSql() {
  return postgres(process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
}

export async function runJobsNow(base: string) {
  const res = await fetch(`${base}/api/cron/all`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  if (!res.ok) throw new Error(`cron failed ${res.status}`);
  const json = (await res.json()) as { result: unknown };
  return json.result;
}
