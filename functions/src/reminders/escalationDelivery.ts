import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { loadFunctionConfig } from '../config.js';
import { sendBrevoEmail } from './brevo.js';

async function isDeliveryAlreadyProcessed(receipt: DocumentReference): Promise<boolean> {
  const previous = await receipt.get();
  const status = String(previous.get('status') ?? '');
  return ['accepted', 'mocked', 'unknown', 'failed'].includes(status);
}

async function getVerifiedRecipientEmail(profile: DocumentReference): Promise<string | null> {
  const settings = await profile.collection('notificationSettings').doc('escalation').get();
  const enabled = Boolean(settings.get('enabled'));
  const consent = Boolean(settings.get('consentConfirmed'));
  const updatedBy = settings.get('updatedBy');

  if (!enabled || !consent || typeof updatedBy !== 'string') return null;

  const member = await profile.collection('members').doc(updatedBy).get();
  const role = String(member.get('role') ?? '');
  const email = settings.get('email');

  if (
    role !== 'caretaker' ||
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }
  return email;
}

/** One send attempt per dose. Ambiguous outcomes require review, never blind retries. */
export async function deliverEscalation(
  profile: DocumentReference,
  doseId: string,
): Promise<boolean> {
  const receipt = profile.collection('alertDeliveries').doc(`${doseId}_email`);
  if (await isDeliveryAlreadyProcessed(receipt)) return true;

  const email = await getVerifiedRecipientEmail(profile);
  if (!email) return false;

  const config = loadFunctionConfig();
  if (!config.mockMode && !config.emailFrom) return false;

  const quota = profile.firestore.doc(`internal/mail-${new Date().toISOString().slice(0, 10)}`);
  const claimed = await profile.firestore.runTransaction(async (tx) => {
    const [dose, existing, usage] = await Promise.all([
      tx.get(profile.collection('doseLogs').doc(doseId)),
      tx.get(receipt),
      tx.get(quota),
    ]);
    if (dose.get('status') !== 'missed') return false;
    if (existing.exists) {
      const updated = existing.get('updatedAt');
      if (
        existing.get('status') === 'sending' &&
        updated instanceof Timestamp &&
        Date.now() - updated.toMillis() > 120000
      ) {
        tx.update(receipt, { status: 'unknown', updatedAt: FieldValue.serverTimestamp() });
      }
      return false;
    }
    const currentCount = Number(usage.get('count') ?? 0);
    if (currentCount >= 50) return false;

    tx.set(quota, { count: currentCount + 1 });
    tx.create(receipt, {
      doseId,
      channel: 'email',
      status: config.mockMode ? 'mocked' : 'sending',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });

  if (!claimed || config.mockMode) return claimed;

  try {
    const fromAddress = config.emailFrom ?? 'support@sanjeevani.app';
    const providerId = await sendBrevoEmail(email, fromAddress, `${profile.id}/${doseId}`);
    await receipt.update({
      status: 'accepted',
      providerId,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch {
    await receipt.update({ status: 'unknown', updatedAt: FieldValue.serverTimestamp() });
  }
  return true;
}
