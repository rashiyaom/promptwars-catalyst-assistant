import { collection, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
import type { CareMember, CareProfile, MemberRole } from '@sanjeevani/shared/types/profile';
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

/** List all care-circle members connected to this profile. */
export async function listCareMembers(profileId: string): Promise<CareMember[]> {
  const clients = getFirebaseClients();
  if (!clients) return [];
  const snapshot = await getDocs(collection(clients.db, 'profiles', profileId, 'members'));
  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      uid: item.id,
      role: (data.role ?? 'family') as MemberRole,
      displayName: String(data.displayName ?? 'Care Member'),
      email: String(data.email ?? ''),
      joinedAt: data.joinedAt instanceof Timestamp ? data.joinedAt.toDate().toISOString() : '',
    };
  });
}

/** Get current user's role in a profile. */
export async function getMyProfileRole(profileId: string): Promise<MemberRole | null> {
  const clients = getFirebaseClients();
  const memberId = clients?.auth.currentUser?.uid;
  if (!clients || !memberId) return null;
  const snapshot = await getDoc(doc(clients.db, 'users', memberId, 'profiles', profileId));
  if (!snapshot.exists()) return null;
  return (snapshot.data().role as MemberRole) ?? null;
}
