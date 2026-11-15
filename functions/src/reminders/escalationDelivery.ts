import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { loadFunctionConfig } from '../config.js';
import { sendBrevoEmail } from './brevo.js';

/** One send attempt per dose. Ambiguous outcomes require review, never blind retries. */
export async function deliverEscalation(profile: DocumentReference, doseId: string): Promise<boolean> {
  const receipt = profile.collection('alertDeliveries').doc(`${doseId}_email`);
  const previous = await receipt.get();
  if (['accepted','mocked','unknown','failed'].includes(previous.get('status'))) return true;
  const settings = await profile.collection('notificationSettings').doc('escalation').get();
  if (!settings.get('enabled') || !settings.get('consentConfirmed') || typeof settings.get('updatedBy') !== 'string') return false;
  const member = await profile.collection('members').doc(settings.get('updatedBy')).get();
  const email = settings.get('email');
  if (member.get('role') !== 'caretaker' || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const config = loadFunctionConfig();
  if (!config.mockMode && !config.emailFrom) return false;
  const quota = profile.firestore.doc(`internal/mail-${new Date().toISOString().slice(0,10)}`);
  const claimed = await profile.firestore.runTransaction(async (tx) => {
    const [dose, existing, usage] = await Promise.all([tx.get(profile.collection('doseLogs').doc(doseId)),tx.get(receipt),tx.get(quota)]);
    if (dose.get('status') !== 'missed') return false;
    if (existing.exists) {
      const updated = existing.get('updatedAt');
      if (existing.get('status') === 'sending' && updated instanceof Timestamp && Date.now()-updated.toMillis()>120000) tx.update(receipt,{status:'unknown',updatedAt:FieldValue.serverTimestamp()});
      return false;
    }
    if (Number(usage.get('count') ?? 0) >= 50) return false;
    tx.set(quota,{count:Number(usage.get('count') ?? 0)+1});
    tx.create(receipt,{doseId,channel:'email',status:config.mockMode?'mocked':'sending',updatedAt:FieldValue.serverTimestamp()});
    return true;
  });
  if (!claimed) return false;
  if (config.mockMode) return true;
  try {
    const providerId = await sendBrevoEmail(email,config.emailFrom!,`${profile.id}/${doseId}`);
    await receipt.update({status:'accepted',providerId,updatedAt:FieldValue.serverTimestamp()});
  } catch { await receipt.update({status:'unknown',updatedAt:FieldValue.serverTimestamp()}); }
  return true;
}
