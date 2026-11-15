import { initializeApp, getApps } from 'firebase-admin/app';
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type QueryDocumentSnapshot,
  type DocumentReference,
} from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logInfo } from '../lib/logger.js';
import { parseLocalTime } from '../lib/schedule.js';

const adminApp = getApps()[0] ?? initializeApp();
const database = getFirestore(adminApp);
const GENERATION_SCHEDULE = 'every 60 minutes';
const MAX_MEDICATIONS_PER_SWEEP = 400;
const LOCAL_DATES_TO_GENERATE = 2;
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];

interface LocalDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function getLocalDateParts(instant: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const partMap = new Map(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(partMap.get('year')),
    month: Number(partMap.get('month')),
    day: Number(partMap.get('day')),
  };
}

function addCalendarDays(date: LocalDateParts, days: number): LocalDateParts {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function formatLocalDate(date: LocalDateParts): string {
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${date.year}-${month}-${day}`;
}

function localDateTimeToUtc(date: LocalDateParts, time: string, timeZone: string): Date | null {
  const parsed = parseLocalTime(time);
  if (!parsed) return null;
  const desired = {
    ...date,
    hours: parsed.hours,
    minutes: parsed.minutes,
  };
  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hours,
    desired.minutes,
  );
  let candidate = desiredAsUtc;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const observed = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(candidate));

    const observedMap = new Map(observed.map((p) => [p.type, p.value]));
    const observedUtc = Date.UTC(
      Number(observedMap.get('year')),
      Number(observedMap.get('month')) - 1,
      Number(observedMap.get('day')),
      Number(observedMap.get('hour')),
      Number(observedMap.get('minute')),
    );

    const difference = desiredAsUtc - observedUtc;
    if (difference === 0) return new Date(candidate);
    candidate += difference;
  }
  return null;
}

function matchesInterval(localDate: string, startDate: string, everyNDays: unknown): boolean {
  if (typeof everyNDays !== 'number' || !Number.isInteger(everyNDays) || everyNDays < 1)
    return false;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const current = new Date(`${localDate}T00:00:00.000Z`);
  const dayDifference = Math.floor((current.getTime() - start.getTime()) / 86_400_000);
  return dayDifference >= 0 && dayDifference % everyNDays === 0;
}

function isScheduledDate(
  date: LocalDateParts,
  startDate: string,
  endDate: string | null,
  frequency: unknown,
): boolean {
  const localDate = formatLocalDate(date);
  if (localDate < startDate || (endDate && localDate > endDate)) return false;
  if (typeof frequency !== 'object' || frequency === null || !('type' in frequency)) return false;

  const value = frequency as {
    readonly type: unknown;
    readonly days?: unknown;
    readonly everyNDays?: unknown;
  };
  if (value.type === 'daily') return true;
  if (value.type === 'weekdays') {
    const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
    const days = Array.isArray(value.days) ? value.days : DEFAULT_WEEKDAYS;
    return days.includes(weekday);
  }
  if (value.type === 'interval') {
    return matchesInterval(localDate, startDate, value.everyNDays);
  }
  return false;
}

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
      snoozeCount: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

async function generateDosesForMedication(
  profileReference: DocumentReference,
  medicationSnapshot: QueryDocumentSnapshot,
  timeZone: string,
): Promise<number> {
  const data = medicationSnapshot.data() as Record<string, unknown>;
  const startDate = typeof data.startDate === 'string' ? data.startDate : null;
  const times = Array.isArray(data.times) ? data.times : null;
  if (!startDate || !times) return 0;

  let count = 0;
  const today = getLocalDateParts(new Date(), timeZone);
  for (let offset = 0; offset < LOCAL_DATES_TO_GENERATE; offset += 1) {
    const localDate = addCalendarDays(today, offset);
    const endDate = typeof data.endDate === 'string' ? data.endDate : null;
    if (!isScheduledDate(localDate, startDate, endDate, data.frequency)) continue;

    for (const time of times) {
      if (typeof time !== 'string') continue;
      const scheduledFor = localDateTimeToUtc(localDate, time, timeZone);
      if (!scheduledFor) continue;
      if (await createDoseLog(profileReference.id, medicationSnapshot.id, scheduledFor)) {
        count += 1;
      }
    }
  }
  return count;
}

/** Materialize the next local care days into stable, duplicate-safe dose logs. */
export const generateUpcomingDoseLogs = onSchedule(
  {
    schedule: GENERATION_SCHEDULE,
    timeZone: 'Etc/UTC',
    region: 'us-central1',
    maxInstances: 1,
  },
  async () => {
    const medications = await database
      .collectionGroup('medications')
      .where('active', '==', true)
      .limit(MAX_MEDICATIONS_PER_SWEEP)
      .get();
    let createdCount = 0;

    for (const medicationSnapshot of medications.docs) {
      const profileReference = medicationSnapshot.ref.parent.parent;
      if (!profileReference) continue;
      const profileSnapshot = await profileReference.get();
      const timeZone = String(profileSnapshot.get('timezone') ?? '');
      if (!profileSnapshot.exists || !timeZone) continue;

      try {
        createdCount += await generateDosesForMedication(
          profileReference,
          medicationSnapshot,
          timeZone,
        );
      } catch {
        logInfo({
          event: 'dose_logs.skipped_invalid_schedule',
          profileId: profileReference.id,
          eventId: medicationSnapshot.id,
        });
      }
    }

    logInfo({ event: 'dose_logs.generation_complete', detail: `created=${createdCount}` });
  },
);
