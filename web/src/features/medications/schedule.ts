import type { Medication } from '@sanjeevani/shared/types/medication';
import type { DoseLog } from '@sanjeevani/shared/types/doseLog';

export const DAY_PERIODS = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;

/** Profile-local calendar date, independent of the browser's time zone. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Add whole calendar days without daylight-saving drift. */
export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/** Convert a wall-clock date/time to an instant; reject nonexistent DST times. */
export function zonedInstant(date: string, time: string, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const desired = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(desired)) return null;
  if (new Date(desired).toISOString().slice(0, 16) !== `${date}T${time}`) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    return null;
  }
  let candidate = desired;
  for (let i = 0; i < 4; i += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(candidate));
    const v = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const observed = Date.parse(`${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}:00Z`);
    if (desired === observed) return new Date(candidate);
    candidate += desired - observed;
  }
  return null;
}

/** Honor date limits, paused schedules, selected weekdays, and interval anchors. */
export function isScheduled(medication: Medication, date: string): boolean {
  if (
    !medication.active ||
    date < medication.startDate ||
    (medication.endDate && date > medication.endDate)
  )
    return false;
  const frequency = medication.frequency;
  if (frequency.type === 'daily') return true;
  if (frequency.type === 'weekdays')
    return (frequency.days ?? [1, 2, 3, 4, 5]).includes(new Date(`${date}T12:00:00Z`).getUTCDay());
  const days = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${medication.startDate}T00:00:00Z`)) /
      86_400_000,
  );
  return days % frequency.everyNDays === 0;
}

/** IDs match the backend generator; each scheduled time is an independent dose. */
export function scheduledDoses(
  medications: readonly Medication[],
  date: string,
  timeZone: string,
): DoseLog[] {
  return medications
    .filter((med) => isScheduled(med, date))
    .flatMap((med) =>
      [...new Set(med.times)].flatMap((time): DoseLog[] => {
        const instant = zonedInstant(date, time, timeZone);
        if (!instant) return [];
        const scheduledFor = instant.toISOString();
        return [
          {
            id: `${med.id}_${scheduledFor.replace(/[^0-9]/g, '')}`,
            medicationId: med.id,
            scheduledFor,
            status: 'pending',
            loggedBy: null,
            loggedAt: null,
            reminderSentAt: null,
            missedAlertSentAt: null,
          },
        ];
      }),
    )
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

/** Night wraps midnight; boundaries are 05:00, 12:00, 17:00 and 21:00. */
export function dayPeriod(instant: string, timeZone: string): (typeof DAY_PERIODS)[number] {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(
      new Date(instant),
    ),
  );
  return hour >= 5 && hour < 12
    ? 'Morning'
    : hour < 17 && hour >= 12
      ? 'Afternoon'
      : hour >= 17 && hour < 21
        ? 'Evening'
        : 'Night';
}

/** Summarize recorded history only: absent logs never imply a missed dose. */
export function adherenceWeek(logs: readonly DoseLog[], today: string, timeZone: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const doses = logs.filter((log) => localDate(new Date(log.scheduledFor), timeZone) === date);
    return {
      date,
      total: doses.length,
      taken: doses.filter((log) => log.status === 'taken').length,
      missed: doses.filter((log) => log.status === 'missed').length,
      skipped: doses.filter((log) => log.status === 'skipped').length,
      pending: doses.filter((log) => log.status === 'pending').length,
    };
  });
}
