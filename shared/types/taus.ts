/** At most two ten-minute follow-ups, always strictly before the fixed grace deadline. */
export function nextSnoozeTime(scheduledAt: number, graceMinutes: number, count: number, status: unknown, now: number): number | null {
  if (!Number.isFinite(scheduledAt) || !Number.isFinite(now) || !Number.isInteger(count) || count < 0 || !Number.isInteger(graceMinutes) || graceMinutes < 5 || graceMinutes > 240 || status !== 'pending' || count >= 2 || scheduledAt > now) return null;
  const next = now + 10 * 60_000;
  return next < scheduledAt + graceMinutes * 60_000 ? next : null;
}
