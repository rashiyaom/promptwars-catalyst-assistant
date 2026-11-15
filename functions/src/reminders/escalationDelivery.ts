import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { loadFunctionConfig } from '../config.js';

/** Queue one deterministic message for Firebase Trigger Email. Queueing is not delivery. */
export async function deliverEscalation(profile: DocumentReference, doseId: string): Promise<boolean> {
  const settings = await profile.collection('notificationSettings').doc('escalation').get();
  if (!settings.get('enabled') || !settings.get('consentConfirmed') || typeof settings.get('updatedBy') !== 'string') return false;
  const member = await profile.collection('members').doc(settings.get('updatedBy')).get();
  const email = settings.get('email');
  if (member.get('role') !== 'caretaker' || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const mail = profile.firestore.collection('mail').doc(`${profile.id}_${doseId}`);
  const receipt = profile.collection('alertDeliveries').doc(`${doseId}_email`);
  return profile.firestore.runTransaction(async (tx) => {
    const [dose, existing] = await Promise.all([tx.get(profile.collection('doseLogs').doc(doseId)), tx.get(mail)]);
    if (dose.get('status') !== 'missed' || existing.exists) return true;
    const mock = loadFunctionConfig().mockMode;
    if (!mock) tx.create(mail, { to: [email], message: { subject: 'Taus care check-in', text: 'A scheduled medicine has not been confirmed. Please sign in to Sanjeevani and check with your care circle.' } });
    tx.set(receipt, { doseId, channel: 'email', status: mock ? 'mocked' : 'pending', updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
}
