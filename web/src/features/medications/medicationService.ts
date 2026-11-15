import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  limit,
  where,
  query,
  Timestamp,
  updateDoc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import type { DoseLog } from '@sanjeevani/shared/types/doseLog';
import type { Medication } from '@sanjeevani/shared/types/medication';
import { medicationInputSchema, type MedicationInput } from '@sanjeevani/shared/schemas/medication';
import { getFirebaseClients } from '../../lib/firebase.js';

/** Read a member's medication schedules from their care profile. */
export async function listMedications(profileId: string): Promise<Medication[]> {
  const clients = getFirebaseClients();
  if (!clients) return [];
  const reference = collection(clients.db, 'profiles', profileId, 'medications');
  const result = await getDocs(query(reference, orderBy('name')));
  return result.docs.map((item) => ({ id: item.id, ...item.data() }) as Medication);
}

/** Add a schedule entered by a profile member with medication edit permission. */
export async function addMedication(
  profileId: string,
  input: MedicationInput,
): Promise<string> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Medication storage is unavailable in offline demo mode.');
  const parsed = medicationInputSchema.safeParse(input);
  if (!parsed.success) throw new Error('Check the medication name, dose, schedule, and dates.');
  const reference = collection(clients.db, 'profiles', profileId, 'medications');
  const memberId = clients.auth.currentUser?.uid;
  if (!memberId) throw new Error('Sign in to add a medication schedule.');
  const result = await addDoc(reference, {
    ...parsed.data,
    updatedBy: memberId,
    updatedAt: Timestamp.now(),
  });
  return result.id;
}

/** Read dose history ordered by its scheduled time. */
export async function listDoseLogs(profileId: string): Promise<DoseLog[]> {
  const clients = getFirebaseClients();
  if (!clients) return [];
  const reference = collection(clients.db, 'profiles', profileId, 'doseLogs');
  const result = await getDocs(query(reference, where('scheduledFor', '>=', Timestamp.fromMillis(Date.now() - 8 * 86400000)), orderBy('scheduledFor', 'desc'), limit(1000)));
  return result.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      medicationId: String(data.medicationId ?? ''),
      nextReminderAt: data.nextReminderAt instanceof Timestamp ? data.nextReminderAt.toDate().toISOString() : null,
      snoozeCount: Number(data.snoozeCount ?? 0),
      scheduledFor: data.scheduledFor instanceof Timestamp ? data.scheduledFor.toDate().toISOString() : '',
      status: data.status as DoseLog['status'],
      loggedBy: typeof data.loggedBy === 'string' ? data.loggedBy : null,
      loggedAt: data.loggedAt instanceof Timestamp ? data.loggedAt.toDate().toISOString() : null,
      reminderSentAt: data.reminderSentAt instanceof Timestamp ? data.reminderSentAt.toDate().toISOString() : null,
      missedAlertSentAt: data.missedAlertSentAt instanceof Timestamp ? data.missedAlertSentAt.toDate().toISOString() : null,
    };
  });
}

/** Mark a scheduled dose as taken or skipped by the current signed-in member. */
export async function logDose(
  profileId: string,
  doseLogId: string,
  status: 'taken' | 'skipped',
  dose?: DoseLog,
): Promise<void> {
  const clients = getFirebaseClients();
  const memberId = clients?.auth.currentUser?.uid;
  if (!clients || !memberId) throw new Error('Sign in to record a dose.');
  const reference = collection(clients.db, 'profiles', profileId, 'doseLogs');
  const target = doc(reference, doseLogId);
  if (!(await getDoc(target)).exists() && dose) {
    await setDoc(target, { medicationId: dose.medicationId, scheduledFor: Timestamp.fromDate(new Date(dose.scheduledFor)), status, loggedBy: memberId, loggedAt: Timestamp.now() });
  } else await updateDoc(target, { status, loggedBy: memberId, loggedAt: Timestamp.now() });
}

/** Update an existing medication schedule. */
export async function updateMedication(
  profileId: string,
  medicationId: string,
  input: MedicationInput,
): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Medication update is unavailable in offline demo mode.');
  const parsed = medicationInputSchema.safeParse(input);
  if (!parsed.success) throw new Error('Check the medication details.');
  const memberId = clients.auth.currentUser?.uid;
  if (!memberId) throw new Error('Sign in to update medication.');
  await updateDoc(doc(clients.db, 'profiles', profileId, 'medications', medicationId), {
    ...parsed.data,
    updatedBy: memberId,
    updatedAt: Timestamp.now(),
  });
}

/** Delete a medication schedule from the profile. */
export async function deleteMedication(profileId: string, medicationId: string): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Medication deletion is unavailable in offline demo mode.');
  await deleteDoc(doc(clients.db, 'profiles', profileId, 'medications', medicationId));
}
