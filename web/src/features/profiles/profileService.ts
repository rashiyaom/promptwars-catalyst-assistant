import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import type { CareProfile } from '@sanjeevani/shared/types/profile';
import { getFirebaseClients } from '../../lib/firebase.js';

/** List care profiles linked to the authenticated member account. */
export async function listMyCareProfiles(): Promise<CareProfile[]> {
  const clients = getFirebaseClients();
  const memberId = clients?.auth.currentUser?.uid;
  if (!clients || !memberId) return [];

  const membershipCollection = collection(clients.db, 'users', memberId, 'profiles');
  const memberships = await getDocs(membershipCollection);
  return memberships.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      elderName: String(data.elderName ?? 'Care profile'),
      timezone: String(data.timezone ?? 'UTC'),
      graceMinutes: Number(data.graceMinutes ?? 30),
    };
  });
}

/** Read a care profile after membership has been established by the backend. */
export async function getCareProfile(profileId: string): Promise<CareProfile | null> {
  const clients = getFirebaseClients();
  if (!clients) return null;
  const snapshot = await getDoc(doc(clients.db, 'profiles', profileId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    elderName: String(data.elderName ?? ''),
    timezone: String(data.timezone ?? 'UTC'),
    graceMinutes: Number(data.graceMinutes ?? 30),
  };
}
