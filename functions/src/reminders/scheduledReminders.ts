import { initializeApp, getApps } from 'firebase-admin/app';
import {
  FieldValue,
  FieldPath,
  Timestamp,
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
} from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { brevoCredentials } from './brevo.js';
import { deliverEscalation } from './escalationDelivery.js';
import { loadFunctionConfig } from '../config.js';
import { logInfo } from '../lib/logger.js';

const adminApp = getApps()[0] ?? initializeApp();
const database = getFirestore(adminApp);
const REMINDER_SCHEDULE = 'every 10 minutes';
const REMINDER_WINDOW_MS = 15 * 60 * 1000;
const APPOINTMENT_DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const APPOINTMENT_SOON_WINDOW_MS = 2 * 60 * 60 * 1000;
const DEFAULT_GRACE_MINUTES = 30;
const MAX_REMINDER_RETRIES = 3;
const SENDING_LEASE_MS = 2 * 60 * 1000;
const MAX_DOSES_PER_SWEEP = 100;
const MAX_APPOINTMENTS_PER_SWEEP = 50;
const MAX_FCM_TOKENS_PER_REQUEST = 500;

type ReminderKind = 'upcoming-dose' | 'missed-dose' | 'appointment-day-before' | 'appointment-two-hours';
interface CareRecipient {
  readonly uid: string;
  readonly email: string;
}
interface ClaimResult {
  readonly send: boolean;
  readonly done: boolean;
  readonly attempt: number;
}

/** Return true when local or explicitly configured mock delivery should be used. */
function isMockMode(): boolean {
  return loadFunctionConfig().mockMode;
}

/** Resolve member emails for a profile without logging their personal details. */
async function listRecipients(
  profileReference: DocumentReference,
  elderOnly: boolean,
): Promise<CareRecipient[]> {
  const snapshot = await profileReference.collection('members').get();
  return snapshot.docs.flatMap((member) => {
    const data = member.data();
    if (typeof data.email !== 'string' || !data.email.includes('@')) return [];
    if (elderOnly && data.role !== 'elder') return [];
    return [{ uid: member.id, email: data.email }];
  });
}

/** Atomically claim one deterministic reminder record, or resume an expired lease. */
async function claimReminder(reference: DocumentReference): Promise<ClaimResult> {
  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.data() ?? {};
    const status = current.status;
    const attempt = Number(current.attempts ?? 0);
    if (status === 'sent' || status === 'mocked') return { send: false, done: true, attempt };
    const nextAttemptAt = current.nextAttemptAt instanceof Timestamp
      ? current.nextAttemptAt.toMillis()
      : 0;
    if (nextAttemptAt > Date.now()) return { send: false, done: false, attempt };
    const leaseUntil = current.leaseUntil instanceof Timestamp ? current.leaseUntil.toMillis() : 0;
    if (status === 'sending' && leaseUntil > Date.now()) {
      return { send: false, done: false, attempt };
    }
    if (attempt >= MAX_REMINDER_RETRIES) {
      transaction.set(reference, {
        status: 'failed',
        attempts: attempt,
        failedAt: FieldValue.serverTimestamp(),
        leaseUntil: FieldValue.delete(),
      }, { merge: true });
      return { send: false, done: false, attempt };
    }

    const nextAttempt = attempt + 1;
    transaction.set(reference, {
      status: 'sending',
      attempts: nextAttempt,
      leaseUntil: Timestamp.fromMillis(Date.now() + SENDING_LEASE_MS),
      nextAttemptAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { send: true, done: false, attempt: nextAttempt };
  });
}

/** Deliver one idempotent email and privacy-preserving push alert per recipient. */
async function deliverReminder(
  profileReference: DocumentReference,
  kind: ReminderKind,
  eventId: string,
  recipients: readonly CareRecipient[],
): Promise<boolean> {
  const profileId = profileReference.id;
  const eventReference = profileReference.collection('reminders').doc(`${kind}_${eventId}`);
  const claim = await claimReminder(eventReference);
  if (claim.done) return true;
  if (!claim.send) return false;

  if (isMockMode()) {
    logInfo({ event: 'reminder.mocked', profileId, eventId: `${kind}:${eventId}` });
    await eventReference.set({
      status: 'mocked',
      mockedAt: FieldValue.serverTimestamp(),
      leaseUntil: FieldValue.delete(),
    }, { merge: true });
    return true;
  }

  try {
    const messaging = getMessaging(adminApp);

    for (const recipient of recipients) {
      const tokenSnapshot = await profileReference
        .collection('members').doc(recipient.uid)
        .collection('private').doc('notifications')
        .collection('pushTokens').get();
      const tokenDocuments = tokenSnapshot.docs.filter((item) => typeof item.data().token === 'string');
      const tokens = tokenDocuments.map((item) => String(item.data().token));
      for (let offset = 0; offset < tokens.length; offset += MAX_FCM_TOKENS_PER_REQUEST) {
        const batchTokens = tokens.slice(offset, offset + MAX_FCM_TOKENS_PER_REQUEST);
        const batchDocuments = tokenDocuments.slice(offset, offset + MAX_FCM_TOKENS_PER_REQUEST);
        const pushResult = await messaging.sendEachForMulticast({
          tokens: batchTokens,
          notification: {
            title: 'Sanjeevani care reminder',
            body: 'Open Sanjeevani to review a care-circle reminder.',
          },
          data: { eventId: `${kind}:${eventId}` },
          android: { collapseKey: 'sanjeevani-care-alerts' },
          webpush: { headers: { Urgency: 'normal', Topic: 'care-alerts' } },
        });
        const invalidTokens = pushResult.responses.flatMap((response, index) =>
          response.error?.code === 'messaging/registration-token-not-registered'
            ? [batchDocuments[index].ref.delete()]
            : [],
        );
        await Promise.all(invalidTokens);
      }
    }

    await eventReference.set({
      status: 'sent',
      sentAt: FieldValue.serverTimestamp(),
      recipientCount: recipients.length,
      leaseUntil: FieldValue.delete(),
      nextAttemptAt: FieldValue.delete(),
    }, { merge: true });
    logInfo({ event: 'reminder.sent', profileId, eventId: `${kind}:${eventId}` });
    return true;
  } catch (error) {
    const retryDelayMs = 30_000 * (2 ** Math.max(0, claim.attempt - 1));
    await eventReference.set({
      status: claim.attempt >= MAX_REMINDER_RETRIES ? 'failed' : 'pending',
      nextAttemptAt: Timestamp.fromMillis(Date.now() + retryDelayMs),
      leaseUntil: FieldValue.delete(),
      lastErrorCode: error instanceof Error ? 'DELIVERY_FAILED' : 'UNKNOWN_FAILURE',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    logInfo({ event: 'reminder.delivery_failed', profileId, eventId: `${kind}:${eventId}` });
    return false;
  }
}

/** Mark one dose as missed if it is still pending after the profile grace period. */
async function markDoseMissed(
  reference: DocumentReference,
  snapshot: DocumentSnapshot,
): Promise<boolean> {
  const scheduledFor = snapshot.get('scheduledFor');
  if (!(scheduledFor instanceof Timestamp) || snapshot.get('status') !== 'pending') return false;
  const profileReference = reference.parent.parent;
  if (!profileReference) return false;
  const profileSnapshot = await profileReference.get();
  const configuredGrace = Number(profileSnapshot.get('graceMinutes') ?? DEFAULT_GRACE_MINUTES);
  const graceMinutes = Number.isInteger(configuredGrace) && configuredGrace >= 5 && configuredGrace <= 240
    ? configuredGrace
    : DEFAULT_GRACE_MINUTES;
  if (Date.now() < scheduledFor.toMillis() + graceMinutes * 60_000) return false;

  return database.runTransaction(async (transaction) => {
    const latest = await transaction.get(reference);
    if (latest.get('status') !== 'pending') return false;
    transaction.update(reference, { status: 'missed', missedAt: FieldValue.serverTimestamp() });
    return true;
  });
}

/** Persist a sweep cursor so unconfigured profiles cannot starve later doses.
 * Scanning by status also includes legacy logs without escalationProcessedAt.
 */
async function dosePage(status: 'pending' | 'missed', before: Timestamp) {
  const cursorRef = database.doc(`internal/reminder-cursor-${status}`);
  const cursor = await cursorRef.get();
  let query = database.collectionGroup('doseLogs').where('status', '==', status)
    .where('scheduledFor', '<=', before).orderBy('scheduledFor').orderBy(FieldPath.documentId()).limit(MAX_DOSES_PER_SWEEP);
  if (cursor.get('scheduledFor') instanceof Timestamp && typeof cursor.get('path') === 'string') {
    query = query.startAfter(cursor.get('scheduledFor'), database.doc(cursor.get('path')));
  }
  const page = await query.get();
  return { page, advance: async () => {
    const last = page.docs.at(-1);
    await cursorRef.set(last && page.size === MAX_DOSES_PER_SWEEP ? { scheduledFor: last.get('scheduledFor'), path: last.ref.path } : { scheduledFor: null, path: null });
  } };
}

/** Run email and push reminders for due doses and near-term appointments. */
export const sendScheduledCareReminders = onSchedule({
  schedule: REMINDER_SCHEDULE,
  timeZone: 'Etc/UTC',
  region: 'us-central1',
  maxInstances: 1,
  minInstances: 0,
  memory: '256MiB',
  timeoutSeconds: 120,
  secrets: [brevoCredentials],
}, async () => {
  const now = Date.now();
  const upcomingLimit = Timestamp.fromMillis(now + REMINDER_WINDOW_MS);
  const pending = await dosePage('pending', upcomingLimit);
  const pendingDoses = pending.page;

  for (const doseSnapshot of pendingDoses.docs) {
    const doseReference = doseSnapshot.ref;
    const profileReference = doseReference.parent.parent;
    const scheduledFor = doseSnapshot.get('scheduledFor');
    const medicationId = doseSnapshot.get('medicationId');
    if (!profileReference || !(scheduledFor instanceof Timestamp) || typeof medicationId !== 'string') continue;
    const medication = await profileReference.collection('medications').doc(medicationId).get();
    if (!medication.exists || medication.get('active') !== true) continue;

    const missed = await markDoseMissed(doseReference, doseSnapshot);
    if (missed) {
      const complete = await deliverEscalation(profileReference, doseReference.id);
      if (complete) await doseReference.set({ escalationProcessedAt: FieldValue.serverTimestamp() }, { merge: true });
      continue;
    }
    // Respect the user's bounded follow-up without extending the fixed missed-dose deadline.
    const followUp = doseSnapshot.get('nextReminderAt');
    if (followUp instanceof Timestamp && followUp.toMillis() <= now) {
      const recipients = await listRecipients(profileReference, true);
      if (recipients.length && await deliverReminder(profileReference, 'upcoming-dose', `${doseReference.id}_snooze${doseSnapshot.get('snoozeCount')}`, recipients)) {
        await database.runTransaction(async (tx) => {
          const current = await tx.get(doseReference);
          if (current.get('nextReminderAt') instanceof Timestamp && current.get('nextReminderAt').isEqual(followUp)) tx.update(doseReference, { nextReminderAt: null });
        });
      }
      continue;
    }
    const kind: ReminderKind = 'upcoming-dose';
    if (!missed && doseSnapshot.get('reminderSentAt') != null) continue;
    if (!missed && followUp instanceof Timestamp) continue;
    const recipients = await listRecipients(profileReference, !missed);
    if (recipients.length === 0) continue;

    const delivered = await deliverReminder(profileReference, kind, doseReference.id, recipients);
    if (delivered) {
      const flag = missed ? 'missedAlertSentAt' : 'reminderSentAt';
      await doseReference.set({ [flag]: FieldValue.serverTimestamp() }, { merge: true });
    }
  }

  await pending.advance();
  const missedPage = await dosePage('missed', Timestamp.fromMillis(now));
  const missedDoses = missedPage.page;
  for (const doseSnapshot of missedDoses.docs) {
    const profileReference = doseSnapshot.ref.parent.parent;
    if (!profileReference || doseSnapshot.get('escalationProcessedAt') != null) continue;
    const complete = await deliverEscalation(profileReference, doseSnapshot.id);
    if (complete) await doseSnapshot.ref.set({ escalationProcessedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  await missedPage.advance();

  const appointmentLimit = Timestamp.fromMillis(now + APPOINTMENT_DAY_WINDOW_MS);
  const appointments = await database.collectionGroup('appointments')
    .where('dateTime', '>', Timestamp.fromMillis(now))
    .where('dateTime', '<=', appointmentLimit)
    .limit(MAX_APPOINTMENTS_PER_SWEEP)
    .get();

  for (const appointmentSnapshot of appointments.docs) {
    const appointmentReference = appointmentSnapshot.ref;
    const profileReference = appointmentReference.parent.parent;
    const dateTime = appointmentSnapshot.get('dateTime');
    if (!profileReference || !(dateTime instanceof Timestamp)) continue;

    const untilAppointment = dateTime.toMillis() - now;
    const remindersSent = appointmentSnapshot.get('remindersSent') ?? {};
    const isTwoHourReminder = untilAppointment <= APPOINTMENT_SOON_WINDOW_MS;
    const reminderField = isTwoHourReminder ? 'twoHours' : 'dayBefore';
    if (remindersSent[reminderField] === true) continue;

    const recipients = await listRecipients(profileReference, false);
    if (recipients.length === 0) continue;
    const kind: ReminderKind = isTwoHourReminder ? 'appointment-two-hours' : 'appointment-day-before';
    const delivered = await deliverReminder(profileReference, kind, appointmentReference.id, recipients);
    if (delivered) {
      await appointmentReference.set({
        remindersSent: { ...remindersSent, [reminderField]: true },
      }, { merge: true });
    }
  }
});
