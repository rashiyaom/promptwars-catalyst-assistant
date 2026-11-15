import { initializeApp, getApps } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logInfo } from '../lib/logger.js';

const adminApp = getApps()[0] ?? initializeApp();
const database = getFirestore(adminApp);
const GENERATION_SCHEDULE = 'every 60 minutes';
const MAX_MEDICATIONS_PER_SWEEP = 400;
const LOCAL_DATES_TO_GENERATE = 2;
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];
const VALID_LOCAL_TIME = /^(?:([01]\d|2[0-3])):([0-5]\d)$/;

interface LocalDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Format an instant as a local calendar date in the profile's time zone. */
function getLocalDateParts(instant: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

/** Return a stable YYYY-MM-DD value for local scheduling and Firestore data. */
function formatLocalDate(date: LocalDateParts): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

/** Add calendar days without relying on the machine's local time zone. */
function addCalendarDays(date: LocalDateParts, days: number): LocalDateParts {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

/** Convert a profile-local date and HH:mm time to UTC, skipping DST gaps. */
function localDateTimeToUtc(
  date: LocalDateParts,
  time: string,
  timeZone: string,
): Date | null {
  const match = VALID_LOCAL_TIME.exec(time);
  if (!match) return null;
  const desired = {
    ...date,
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
  const desiredAsUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hours, desired.minutes);
  let candidate = desiredAsUtc;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const observed = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(candidate));
    const values = Object.fromEntries(observed.map((part) => [part.type, part.value]));
    const observedAsUtc = Date.UTC(
      Number(values.year), Number(values.month) - 1, Number(values.day),
      Number(values.hour), Number(values.minute),
    );
    const difference = desiredAsUtc - observedAsUtc;
    if (difference === 0) return new Date(candidate);
    candidate += difference;
  }
  return null;
}

/** Check whether a local calendar date is included by a medication frequency. */
function isScheduledDate(
  date: LocalDateParts,
  startDate: string,
  endDate: string | null,
  frequency: unknown,
): boolean {
  const localDate = formatLocalDate(date);
  if (localDate < startDate || (endDate && localDate > endDate)) return false;
  if (typeof frequency !== 'object' || frequency === null || !('type' in frequency)) return false;
  const value = frequency as { readonly type: unknown; readonly days?: unknown; readonly everyNDays?: unknown };
  if (value.type === 'daily') return true;
  if (value.type === 'weekdays') {
    const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
    const days = Array.isArray(value.days) ? value.days : DEFAULT_WEEKDAYS;
    return days.includes(weekday);
  }
  if (value.type === 'interval' && typeof value.everyNDays === 'number') {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const current = new Date(`${localDate}T00:00:00.000Z`);
    const dayDifference = Math.floor((current.getTime() - start.getTime()) / 86_400_000);
    return Number.isInteger(value.everyNDays)
      && value.everyNDays >= 1
      && dayDifference >= 0
      && dayDifference % value.everyNDays === 0;
  }
  return false;
}

/** Create one pending log only when its deterministic ID does not exist. */
async function createDoseLog(
  profileId: string,
  medicationId: string,
  scheduledFor: Date,
): Promise<boolean> {
  const timestampKey = scheduledFor.toISOString().replace(/[^0-9]/g, '');
  const logId = `${medicationId}_${timestampKey}`;
  const reference = database.doc(`profiles/${profileId}/doseLogs/${logId}`);
  return database.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference);
    if (existing.exists) return false;
    transaction.create(reference, {
      medicationId,
      scheduledFor: Timestamp.fromDate(scheduledFor),
      status: 'pending',
      loggedBy: null,
      loggedAt: null,
      reminderSentAt: null,
      missedAlertSentAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

/** Materialize the next local care days into stable, duplicate-safe dose logs. */
export const generateUpcomingDoseLogs = onSchedule({
  schedule: GENERATION_SCHEDULE,
  timeZone: 'Etc/UTC',
  region: 'us-central1',
  maxInstances: 1,
}, async () => {
  const medications = await database.collectionGroup('medications')
    .where('active', '==', true)
    .limit(MAX_MEDICATIONS_PER_SWEEP)
    .get();
  let createdCount = 0;

  for (const medicationSnapshot of medications.docs) {
    const profileReference = medicationSnapshot.ref.parent.parent;
    if (!profileReference) continue;
    const profileSnapshot = await profileReference.get();
    const timeZone = profileSnapshot.get('timezone');
    const data = medicationSnapshot.data();
    if (!profileSnapshot.exists || typeof timeZone !== 'string'
      || typeof data.startDate !== 'string' || !Array.isArray(data.times)) continue;

    try {
      const today = getLocalDateParts(new Date(), timeZone);
      for (let dateOffset = 0; dateOffset < LOCAL_DATES_TO_GENERATE; dateOffset += 1) {
        const localDate = addCalendarDays(today, dateOffset);
        const endDate = typeof data.endDate === 'string' ? data.endDate : null;
        if (!isScheduledDate(localDate, data.startDate, endDate, data.frequency)) continue;

        for (const time of data.times) {
          if (typeof time !== 'string') continue;
          const scheduledFor = localDateTimeToUtc(localDate, time, timeZone);
          if (!scheduledFor) continue;
          if (await createDoseLog(profileReference.id, medicationSnapshot.id, scheduledFor)) createdCount += 1;
        }
      }
    } catch {
      logInfo({
        event: 'dose_logs.skipped_invalid_schedule',
        profileId: profileReference.id,
        eventId: medicationSnapshot.id,
      });
    }
  }

  logInfo({ event: 'dose_logs.generation_complete', detail: `created=${createdCount}` });
});
