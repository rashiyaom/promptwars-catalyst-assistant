/**
 * Bounded snooze policy for elder medication safety.
 * At most two ten-minute follow-ups, always strictly before the fixed grace deadline.
 */

function isValidSnoozeRequest(
  scheduledAt: number,
  graceMinutes: number,
  count: number,
  status: unknown,
  now: number,
): boolean {
  if (!Number.isFinite(scheduledAt) || !Number.isFinite(now)) return false;
  if (!Number.isInteger(count) || count < 0 || count >= 2) return false;
  if (!Number.isInteger(graceMinutes) || graceMinutes < 5 || graceMinutes > 240) return false;
  return status === 'pending' && scheduledAt <= now;
}

export function nextSnoozeTime(
  scheduledAt: number,
  graceMinutes: number,
  count: number,
  status: unknown,
  now: number,
): number | null {
  if (!isValidSnoozeRequest(scheduledAt, graceMinutes, count, status, now)) {
    return null;
  }
  const next = now + 10 * 60_000;
  return next < scheduledAt + graceMinutes * 60_000 ? next : null;
}
