import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
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
      specialty: String(data.specialty ?? ''),
      dateTime: data.dateTime instanceof Timestamp ? data.dateTime.toDate().toISOString() : '',
      location: String(data.location ?? ''),
      notes: String(data.notes ?? ''),
    };
  });
}
