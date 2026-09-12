export const WORK_LOG_MIN_MINUTES = 1;
export const WORK_LOG_MAX_MINUTES = 1440;
export const WORK_LOG_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWorkLogEditable(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() <= WORK_LOG_EDIT_WINDOW_MS;
}

/** Inline timer → minutes, rounded up to the nearest minute, clamped to the allowed range. */
export function timerToMinutes(startedAt: Date, endedAt: Date): number {
  const ms = Math.max(0, endedAt.getTime() - startedAt.getTime());
  const minutes = Math.ceil(ms / 60_000);
  return Math.min(WORK_LOG_MAX_MINUTES, Math.max(WORK_LOG_MIN_MINUTES, minutes));
}

export function sumMinutes(entries: readonly { minutes: number; deletedAt?: Date | null }[]): number {
  return entries.filter((e) => !e.deletedAt).reduce((acc, e) => acc + e.minutes, 0);
}

export function validateMinutes(minutes: number): string | null {
  if (!Number.isInteger(minutes)) return "Minutes must be a whole number";
  if (minutes < WORK_LOG_MIN_MINUTES) return "Log at least 1 minute";
  if (minutes > WORK_LOG_MAX_MINUTES) return "A single entry cannot exceed 24 hours";
  return null;
}
