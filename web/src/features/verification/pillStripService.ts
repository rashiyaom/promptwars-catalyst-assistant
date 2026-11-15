import { getGenerativeModel } from 'firebase/ai';
import { getFirebaseClients } from '../../lib/firebase.js';

/** Human-review result from reading a medication label in a photo. */
export interface PillStripCheck {
  readonly result: 'label_matches' | 'label_differs' | 'unclear';
  readonly visibleText: string | null;
  readonly message: string;
}

const MODEL_NAME = 'gemini-3.8-flash';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Convert a small image file to the base64 inline format expected by Firebase AI Logic. */
async function encodeImage(image: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('The selected image could not be encoded.'));
    reader.readAsDataURL(image);
  });
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/** Compare visible package text with an expected schedule label for human review. */
export async function checkPillStripLabel(
  image: File,
  expectedMedicationName: string,
  consentConfirmed: boolean,
): Promise<PillStripCheck> {
  if (!consentConfirmed) throw new Error('Confirm that you want to send this image for AI review.');
  if (!ALLOWED_IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_BYTES) {
    throw new Error('Choose a JPEG, PNG, or WebP image smaller than 10 MB.');
  }

  const clients = getFirebaseClients();
  if (!clients) throw new Error('AI label review is unavailable in offline demo mode.');
  if (!clients.auth.currentUser) throw new Error('Sign in before sending an image for AI label review.');
  if (!expectedMedicationName.trim() || expectedMedicationName.length > 120) {
    throw new Error('Enter the medication name from the schedule before checking a label.');
  }
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    throw new Error('AI label review requires a configured Firebase AI Logic project.');
  }

  const model = getGenerativeModel(clients.ai, {
    model: MODEL_NAME,
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });
  const prompt = [
    'Read only text that is clearly visible on this medicine package or strip.',
    'Do not identify a pill by appearance, infer an active ingredient, dosage, authenticity, or safety.',
    'Return JSON with one field named visibleText: a short verbatim label string, or null if unreadable.',
  ].join(' ');
  const result = await model.generateContent([
    prompt,
    { inlineData: { data: await encodeImage(image), mimeType: image.type } },
  ]);

  let visibleText: string | null = null;
  try {
    const parsed: unknown = JSON.parse(result.response.text());
    if (typeof parsed === 'object' && parsed !== null && 'visibleText' in parsed) {
      const candidate = parsed.visibleText;
      if (typeof candidate === 'string' && candidate.trim()) visibleText = candidate.trim().slice(0, 160);
    }
  } catch {
    visibleText = null;
  }

  if (!visibleText) {
    return {
      result: 'unclear',
      visibleText: null,
      message: 'The label could not be read clearly. Ask a caregiver or pharmacist to check it.',
    };
  }

  const normalize = (value: string): string => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const matches = normalize(visibleText) === normalize(expectedMedicationName);
  return {
    result: matches ? 'label_matches' : 'label_differs',
    visibleText,
    message: matches
      ? 'The printed label looks similar to the schedule name. Confirm the medicine with a caregiver or pharmacist before taking it.'
      : 'The printed label differs from the schedule name. Pause and ask a caregiver or pharmacist to check it.',
  };
}
