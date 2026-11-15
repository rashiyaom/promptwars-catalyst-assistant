import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import type { Appointment } from '@sanjeevani/shared/types/appointment';
import { appointmentInputSchema, type AppointmentInput } from '@sanjeevani/shared/schemas/appointment';
import { getFirebaseClients } from '../../lib/firebase.js';

/** Add a validated appointment for a member of the care profile. */
export async function addAppointment(
  profileId: string,
  input: AppointmentInput,
): Promise<string> {
  const clients = getFirebaseClients();
  const memberId = clients?.auth.currentUser?.uid;
  if (!clients || !memberId) throw new Error('Sign in to add an appointment.');
  const parsed = appointmentInputSchema.safeParse(input);
  if (!parsed.success) throw new Error('Check the doctor name and appointment date.');
  const reference = collection(clients.db, 'profiles', profileId, 'appointments');
  const result = await addDoc(reference, {
    ...parsed.data,
    dateTime: Timestamp.fromDate(new Date(parsed.data.dateTime)),
    createdBy: memberId,
  });
  return result.id;
}

/** List upcoming appointments in chronological order. */
export async function listAppointments(profileId: string): Promise<Appointment[]> {
  const clients = getFirebaseClients();
  if (!clients) return [];
  const reference = collection(clients.db, 'profiles', profileId, 'appointments');
  const result = await getDocs(query(reference, orderBy('dateTime')));
  return result.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      doctorName: String(data.doctorName ?? ''),
      doctorUid: typeof data.doctorUid === 'string' ? data.doctorUid : null,
      specialty: String(data.specialty ?? ''),
      dateTime: data.dateTime instanceof Timestamp ? data.dateTime.toDate().toISOString() : '',
      location: String(data.location ?? ''),
      notes: String(data.notes ?? ''),
    };
  });
}

/** Update an existing appointment. */
export async function updateAppointment(
  profileId: string,
  appointmentId: string,
  input: AppointmentInput,
): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Appointment update is unavailable in offline demo mode.');
  const parsed = appointmentInputSchema.safeParse(input);
  if (!parsed.success) throw new Error('Check the appointment details.');
  await updateDoc(doc(clients.db, 'profiles', profileId, 'appointments', appointmentId), {
    doctorName: parsed.data.doctorName,
    doctorUid: parsed.data.doctorUid ?? null,
    specialty: parsed.data.specialty,
    dateTime: Timestamp.fromDate(new Date(parsed.data.dateTime)),
    location: parsed.data.location,
    notes: parsed.data.notes,
  });
}

/** Delete an appointment. */
export async function deleteAppointment(profileId: string, appointmentId: string): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Appointment deletion is unavailable in offline demo mode.');
  await deleteDoc(doc(clients.db, 'profiles', profileId, 'appointments', appointmentId));
}
