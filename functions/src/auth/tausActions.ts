import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { requireIdentity } from './accessPolicy.js';
import { nextSnoozeTime } from '../lib/tausPolicy.js';
const database = getFirestore(getApps()[0] ?? initializeApp());
const inputSchema = z.object({ profileId: z.string().min(1).max(128).regex(/^[^/]+$/), doseId: z.string().min(1).max(256).regex(/^[^/]+$/) }).strict();
/** A 'not yet' answer schedules a bounded follow-up, never moves the missed-dose deadline. */
export const snoozeDose = onCall({ region: 'us-central1', enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true', maxInstances: 10 }, async (request) => {
  const identity = requireIdentity(request);
  const parsed = inputSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid dose.');
  const profileRef = database.doc(`profiles/${parsed.data.profileId}`);
  return database.runTransaction(async (tx) => {
    const doseRef = profileRef.collection('doseLogs').doc(parsed.data.doseId);
    const [profile, member, dose] = await Promise.all([tx.get(profileRef), tx.get(profileRef.collection('members').doc(identity.uid)), tx.get(doseRef)]);
    if (!member.exists || !['elder', 'caretaker'].includes(member.get('role'))) throw new HttpsError('permission-denied', 'Only the elder or caretaker may record dose responses.');
    const next = nextSnoozeTime(dose.get('scheduledFor') instanceof Timestamp ? dose.get('scheduledFor').toMillis() : NaN, Number(profile.get('graceMinutes') ?? 30), Number(dose.get('snoozeCount') ?? 0), dose.get('status'), Date.now());
    if (next === null) throw new HttpsError('failed-precondition', 'This dose needs care-circle follow-up; its escalation deadline cannot be delayed.');
    tx.update(doseRef, { nextReminderAt: Timestamp.fromMillis(next), snoozeCount: Number(dose.get('snoozeCount') ?? 0) + 1, lastResponseBy: identity.uid, lastResponseAt: FieldValue.serverTimestamp() });
    return { nextReminderAt: new Date(next).toISOString() };
  });
});
