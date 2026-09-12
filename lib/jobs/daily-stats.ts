import "server-only";
import { SYSTEM_CONTEXT } from "@/lib/authz/policy";
import { withContext } from "@/lib/dal/db";
import { refreshDailyStats } from "@/lib/dal/stats";

/** daily_ticket_stats aggregation (architecture.md §13): yesterday + today, per client org, Asia/Colombo days. */
export async function dailyStats(now = new Date()): Promise<{ days: string[] }> {
  const tz = "Asia/Colombo";
  const today = now.toLocaleDateString("en-CA", { timeZone: tz });
  const yesterday = new Date(now.getTime() - 86_400_000).toLocaleDateString("en-CA", { timeZone: tz });
  await withContext(SYSTEM_CONTEXT, async (tx) => {
    await refreshDailyStats(tx, yesterday);
    await refreshDailyStats(tx, today);
  });
  return { days: [yesterday, today] };
}
