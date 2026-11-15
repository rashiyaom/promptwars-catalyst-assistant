import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseClients } from '../../lib/firebase.js';
import { escalationSettingsSchema } from '@sanjeevani/shared/schemas/notification';
import type { EscalationSettings, AlertDelivery } from '@sanjeevani/shared/types/notification';
const demoSettings = new Map<string, EscalationSettings>();
export const DEFAULT_ESCALATION: EscalationSettings = { enabled: false, email: '', smsNumber: '', consentConfirmed: false };
export async function loadEscalationSettings(profileId: string): Promise<EscalationSettings> {
  const clients = getFirebaseClients();
  if (!clients) return demoSettings.get(profileId) ?? DEFAULT_ESCALATION;
  const result = await getDoc(doc(clients.db, 'profiles', profileId, 'notificationSettings', 'escalation'));
  if (!result.exists()) return DEFAULT_ESCALATION;
  const { enabled, email, smsNumber, consentConfirmed } = result.data();
  return escalationSettingsSchema.parse({ enabled, email, smsNumber, consentConfirmed });
}
export async function saveEscalationSettings(profileId: string, settings: EscalationSettings): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) { demoSettings.set(profileId, escalationSettingsSchema.parse(settings)); return; }
  if (!clients.auth.currentUser) throw new Error('Sign in first.');
  await setDoc(doc(clients.db, 'profiles', profileId, 'notificationSettings', 'escalation'), { ...escalationSettingsSchema.parse(settings), updatedBy: clients.auth.currentUser.uid, updatedAt: Timestamp.now() });
}
export async function snoozeDose(profileId: string, doseId: string): Promise<{ nextReminderAt: string }> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Firebase is unavailable.');
  return (await httpsCallable<{ profileId: string; doseId: string }, { nextReminderAt: string }>(clients.functions, 'snoozeDose')({ profileId, doseId })).data;
}
/** Taus sees delivery metadata, not mailbox contents or provider credentials. */
export async function listAlertDeliveries(profileId: string): Promise<AlertDelivery[]> {
  const clients = getFirebaseClients();
  if (!clients) return [];
  const result = await getDocs(query(collection(clients.db, 'profiles', profileId, 'alertDeliveries'), orderBy('updatedAt', 'desc'), limit(12)));
  return result.docs.map((document) => {
    const data = document.data();
    const statuses: readonly string[] = ['pending', 'sending', 'accepted', 'failed', 'unknown', 'mocked'];
    return { id: document.id, channel: 'email', status: statuses.includes(data.status) ? data.status as AlertDelivery['status'] : 'unknown', doseId: String(data.doseId ?? ''), updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : '' };
  });
}
