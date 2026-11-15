import { medicationInputSchema, type MedicationInput } from '@sanjeevani/shared/schemas/medication';
import {
  callGroqChat,
  callGroqVision,
  isGroqConfigured,
  GROQ_TEXT_MODEL,
  GROQ_VISION_MODEL,
} from '../groq/groqClient.js';

export interface PrescriptionExtractionResult {
  readonly success: boolean;
  readonly medications: MedicationInput[];
  readonly rawText?: string;
  readonly error?: string;
}

const PRESCRIPTION_SYSTEM_PROMPT = `You are a clinical pharmacist assistant for Sanjeevani, a care app for older adults.
Analyze the user's prescription (from doctor handwriting, printed summary, or voice dictation in English or Hindi).
Extract each distinct medication into strict JSON format with an array named "medications".
Each item in "medications" must match this schema:
- name: string (e.g. "Metformin", "Amlodipine")
- dosage: string (e.g. "500 mg", "5 mg", "1 tablet")
- times: array of 24-hour time strings in HH:mm format (e.g. ["08:00", "20:00"] for twice daily, ["09:00"] for morning, ["08:00", "14:00", "20:00"] for thrice daily)
- frequency: object with { "type": "daily" } OR { "type": "interval", "everyNDays": number }
- startDate: string in YYYY-MM-DD format (use current date if unspecified)
- endDate: string in YYYY-MM-DD format or null (e.g. calculate from duration like "for 5 days", or null if chronic)
- notes: string (safe dietary instructions, e.g. "Take after food with water. Do not skip.")
- active: true

Output ONLY valid JSON containing {"medications": [...]}. No other markdown or explanation.`;

/** Convert a File object to a base64 Data URL. */
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error('Failed to read the prescription file.'));
    };
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to encode image to base64.'));
    };
    reader.readAsDataURL(file);
  });
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fallback deterministic extraction for offline testing or when Groq is unavailable. */
export function extractMedicationFallback(text: string): MedicationInput[] {
  const today = getTodayIso();
  const lower = text.toLowerCase();

  // Common drug dictionary with English and Hindi transliterations
  const knownMeds = [
    {
      name: 'Metformin',
      regex: /metformin|glycomet|मेटफ़ॉर्मिन|ग्लूकोफ़ेज/i,
      defaultDosage: '500 mg',
      defaultTimes: ['08:00', '20:00'],
      notes: 'Take after meals with water',
    },
    {
      name: 'Amlodipine',
      regex: /amlodipine|norvasc|एम्लोडिपिन/i,
      defaultDosage: '5 mg',
      defaultTimes: ['09:00'],
      notes: 'Take in the morning for blood pressure',
    },
    {
      name: 'Paracetamol',
      regex: /paracetamol|crocin|dolo|calpol|पैरासिटामोल|डोलों?|क्रोसीन/i,
      defaultDosage: '650 mg',
      defaultTimes: ['08:00', '14:00', '20:00'],
      notes: 'Take after meals for fever/pain',
    },
    {
      name: 'Atorvastatin',
      regex: /atorvastatin|lipitor|एटोरवास्टेटिन/i,
      defaultDosage: '20 mg',
      defaultTimes: ['21:00'],
      notes: 'Take at night after dinner',
    },
    {
      name: 'Pantoprazole',
      regex: /pantoprazole|pan[- ]?40|पैंटोप्राज़ोल/i,
      defaultDosage: '40 mg',
      defaultTimes: ['07:30'],
      notes: 'Take on empty stomach 30 mins before breakfast',
    },
    {
      name: 'Telmisartan',
      regex: /telmisartan|telma|टेल्मिसार्टन/i,
      defaultDosage: '40 mg',
      defaultTimes: ['09:00'],
      notes: 'Take regularly in the morning',
    },
    {
      name: 'Aspirin',
      regex: /aspirin|ecosprin|एस्पिरिन/i,
      defaultDosage: '75 mg',
      defaultTimes: ['13:00'],
      notes: 'Take with or after lunch',
    },
  ];

  const results: MedicationInput[] = [];

  for (const med of knownMeds) {
    if (med.regex.test(text)) {
      // Look for custom dosage e.g. "1000 mg", "10mg", or "650 मिलीग्राम"
      const doseMatch = /(\d+)\s*(?:mg|ml|mcg|gm|मिलीग्राम|एमजी)/i.exec(text);
      let dosage = med.defaultDosage;
      if (doseMatch) {
        dosage = `${doseMatch[1]} mg`;
      }

      // Look for times / frequency
      let times = med.defaultTimes;
      if (/once\s*(?:a\s*day|daily)|एक\s*बार/i.test(lower)) times = ['09:00'];
      else if (/twice\s*(?:a\s*day|daily)|दो\s*बार/i.test(lower)) times = ['08:00', '20:00'];
      else if (/thrice|three\s*times|तीन\s*बार/i.test(lower)) times = ['08:00', '14:00', '20:00'];

      results.push({
        name: med.name,
        dosage,
        times,
        frequency: { type: 'daily' },
        startDate: today,
        endDate: null,
        notes: med.notes,
        active: true,
      });
    }
  }

  // If no known drug matches, attempt a generic heuristic extraction
  if (results.length === 0 && text.trim().length > 3) {
    const words = text.trim().split(/\s+/);
    const candidateName = words[0]?.replace(/[^a-zA-Z0-9]/g, '') ?? '';
    const doseMatch = /(\d+\s*(?:mg|ml|mcg|gm|tablet|pills?))/i.exec(text);
    const dosage = doseMatch?.[1]?.trim() ?? '1 tablet';

    results.push({
      name:
        candidateName.charAt(0).toUpperCase() + candidateName.slice(1).toLowerCase() ||
        'Prescribed Medicine',
      dosage,
      times: ['08:00', '20:00'],
      frequency: { type: 'daily' },
      startDate: today,
      endDate: null,
      notes: 'Prescription parsed from patient notes. Verify with pharmacist before taking.',
      active: true,
    });
  }

  return results;
}

/**
 * Parse a prescription from spoken text or natural language dictation using Groq LLM.
 */
export async function parsePrescriptionFromText(
  text: string,
  options: { forceMock?: boolean } = {},
): Promise<PrescriptionExtractionResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      success: false,
      medications: [],
      error: 'Please provide prescription text or speech.',
    };
  }

  const today = getTodayIso();

  // If Groq is not configured or in forceMock mode, use deterministic heuristic fallback
  if (options.forceMock || !isGroqConfigured()) {
    const meds = extractMedicationFallback(trimmed);
    return {
      success: meds.length > 0,
      medications: meds,
      rawText: trimmed,
      error:
        meds.length === 0
          ? 'No medication could be identified. Please enter details manually.'
          : undefined,
    };
  }

  try {
    const prompt = `Prescription input (today is ${today}):\n"${trimmed}"\n\nExtract all prescribed medicines into {"medications": [...]}.`;
    const responseJson = await callGroqChat(
      [
        { role: 'system', content: PRESCRIPTION_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      { jsonMode: true, temperature: 0.1, model: GROQ_TEXT_MODEL },
    );

    const parsed = JSON.parse(responseJson) as { medications?: unknown[] };
    if (!Array.isArray(parsed.medications) || parsed.medications.length === 0) {
      const fallback = extractMedicationFallback(trimmed);
      return { success: fallback.length > 0, medications: fallback, rawText: trimmed };
    }

    const validated: MedicationInput[] = [];
    for (const item of parsed.medications) {
      const candidate = {
        startDate: today,
        endDate: null,
        active: true,
        notes: 'Take as directed by doctor',
        times: ['09:00'],
        frequency: { type: 'daily' },
        ...(typeof item === 'object' && item !== null ? item : {}),
      };
      const check = medicationInputSchema.safeParse(candidate);
      if (check.success) validated.push(check.data);
    }

    if (validated.length === 0) {
      const fallback = extractMedicationFallback(trimmed);
      return { success: fallback.length > 0, medications: fallback, rawText: trimmed };
    }

    return { success: true, medications: validated, rawText: trimmed };
  } catch (error) {
    const fallback = extractMedicationFallback(trimmed);
    return {
      success: fallback.length > 0,
      medications: fallback,
      rawText: trimmed,
      error:
        fallback.length === 0
          ? error instanceof Error
            ? error.message
            : 'Extraction failed'
          : undefined,
    };
  }
}

/**
 * Parse a prescription by sending a prescription photo to Groq Vision.
 */
export async function parsePrescriptionFromImage(
  imageInput: File | string,
  options: { forceMock?: boolean } = {},
): Promise<PrescriptionExtractionResult> {
  let base64Url: string;
  if (typeof imageInput === 'string') {
    base64Url = imageInput;
  } else {
    base64Url = await fileToDataUrl(imageInput);
  }

  const today = getTodayIso();

  if (options.forceMock || !isGroqConfigured()) {
    // Deterministic mock result for offline testing or when keys are absent
    return {
      success: true,
      medications: [
        {
          name: 'Metformin',
          dosage: '500 mg',
          times: ['08:00', '20:00'],
          frequency: { type: 'daily' },
          startDate: today,
          endDate: null,
          notes: 'Take with or after meals. Scanned prescription.',
          active: true,
        },
      ],
      rawText:
        'Prescription scanned in offline demo mode: Metformin 500 mg twice daily with meals.',
    };
  }

  try {
    const prompt = `Read this doctor prescription or medication order carefully (today is ${today}).
Transcribe the written medications and instructions, then return strict JSON matching {"medications": [...]}.
Include: name, dosage, times (HH:mm 24h format), frequency ({type: 'daily'}), startDate ("${today}"), endDate (or null), notes.`;

    const responseJson = await callGroqVision(prompt, base64Url, {
      jsonMode: true,
      model: GROQ_VISION_MODEL,
    });
    const parsed = JSON.parse(responseJson) as {
      medications?: unknown[];
      transcribedText?: string;
    };

    if (!Array.isArray(parsed.medications) || parsed.medications.length === 0) {
      return {
        success: false,
        medications: [],
        error:
          'No legible medications detected in this prescription photo. Please ensure clear lighting and legible text.',
      };
    }

    const validated: MedicationInput[] = [];
    for (const item of parsed.medications) {
      const candidate = {
        startDate: today,
        endDate: null,
        active: true,
        notes: 'Scanned from prescription',
        times: ['09:00'],
        frequency: { type: 'daily' },
        ...(typeof item === 'object' && item !== null ? item : {}),
      };
      const check = medicationInputSchema.safeParse(candidate);
      if (check.success) validated.push(check.data);
    }

    return {
      success: validated.length > 0,
      medications: validated,
      rawText: parsed.transcribedText,
      error:
        validated.length === 0 ? 'Extracted fields did not meet medication schema.' : undefined,
    };
  } catch (error) {
    return {
      success: false,
      medications: [],
      error: error instanceof Error ? error.message : 'Failed to scan prescription image with AI.',
    };
  }
}
