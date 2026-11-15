import { describe, expect, it } from 'vitest';
import {
  parsePrescriptionFromText,
  extractMedicationFallback,
} from '../web/src/features/prescription/prescriptionService.js';
import {
  checkPillStripLabel,
  isDrugNameMatch,
} from '../web/src/features/verification/pillStripService.js';
import { medicationInputSchema } from '../shared/schemas/medication.js';

describe('Prescription Parsing from Speech and Text (Groq / Offline Fallback)', () => {
  it('extracts prescribed medication details from English dictation', async () => {
    const text = 'Add prescription: Metformin 500mg twice a day at 8am and 8pm with meals';
    const result = await parsePrescriptionFromText(text, { forceMock: true });

    expect(result.success).toBe(true);
    expect(result.medications.length).toBeGreaterThan(0);

    const med = result.medications[0];
    expect(med.name).toBe('Metformin');
    expect(med.dosage).toBe('500 mg');
    expect(med.times).toEqual(['08:00', '20:00']);
    expect(med.frequency.type).toBe('daily');
    expect(medicationInputSchema.safeParse(med).success).toBe(true);
  });

  it('extracts prescribed medication details from Hindi dictation', async () => {
    const text = 'एक नई दवा जोड़ो पैरासिटामोल 650 मिलीग्राम दिन में दो बार';
    const result = await parsePrescriptionFromText(text, { forceMock: true });

    expect(result.success).toBe(true);
    expect(result.medications.length).toBeGreaterThan(0);

    const med = result.medications[0];
    expect(med.name).toBe('Paracetamol');
    expect(med.dosage).toBe('650 mg');
    expect(med.times).toEqual(['08:00', '20:00']);
    expect(medicationInputSchema.safeParse(med).success).toBe(true);
  });

  it('handles arbitrary doctor prescriptions with heuristic fallback', () => {
    const parsed = extractMedicationFallback(
      'Levothyroxine 50 mcg once a day in the morning before breakfast',
    );
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('Levothyroxine');
    expect(parsed[0].dosage).toBe('50 mcg');
    expect(medicationInputSchema.safeParse(parsed[0]).success).toBe(true);
  });

  it('returns clean error on empty or whitespace prescription text', async () => {
    const result = await parsePrescriptionFromText('   ');
    expect(result.success).toBe(false);
    expect(result.medications).toHaveLength(0);
    expect(result.error).toBeDefined();
  });
});

describe('Real Pill Strip Label Verification', () => {
  it('correctly compares drug names with salt and brand variations', () => {
    expect(isDrugNameMatch('Amlodipine Besylate', 'Amlodipine')).toBe(true);
    expect(isDrugNameMatch('Metformin Hydrochloride', 'Metformin')).toBe(true);
    expect(isDrugNameMatch('Metformin', 'Atorvastatin')).toBe(false);
    expect(isDrugNameMatch('Crocin 650', 'Paracetamol')).toBe(false);
  });

  it('verifies matching label with high confidence', async () => {
    const sample = 'data:image/jpeg;base64,samplematchingpackaging';
    const check = await checkPillStripLabel(sample, 'Metformin', true, {
      expectedDosage: '500 mg',
      forceMock: true,
    });

    expect(check.result).toBe('label_matches');
    expect(check.detectedDrugName).toBe('Metformin');
    expect(check.confidence).toBeGreaterThan(0.9);
    expect(check.message).toContain('Verified match');
  });

  it('detects mismatching label and issues strong safety warning', async () => {
    const sample = 'data:image/jpeg;base64,differentpillstrip';
    const check = await checkPillStripLabel(sample, 'Metformin', true, {
      expectedDosage: '500 mg',
      forceMock: true,
    });

    expect(check.result).toBe('label_differs');
    expect(check.detectedDrugName).toBe('Atorvastatin');
    expect(check.message).toContain('Warning');
    expect(check.message).toContain('differs from Metformin');
  });

  it('requires explicit consent before sending image for inspection', async () => {
    await expect(
      checkPillStripLabel('data:image/jpeg;base64,dummy', 'Metformin', false),
    ).rejects.toThrow(/Confirm that you want to check/);
  });

  it('requires non-empty expected medication name', async () => {
    await expect(checkPillStripLabel('data:image/jpeg;base64,dummy', '   ', true)).rejects.toThrow(
      /Select or enter the expected medication/,
    );
  });
});
