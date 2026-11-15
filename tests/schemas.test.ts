import { describe, expect, it } from 'vitest';
import { medicationInputSchema } from '../shared/schemas/medication.js';
import { appointmentInputSchema } from '../shared/schemas/appointment.js';

describe('Shared Schema Validation', () => {
  describe('MedicationInput Schema', () => {
    it('accepts valid daily medication schedule', () => {
      const validMedication = {
        name: 'Amlodipine',
        dosage: '5 mg oral tablet',
        times: ['08:00', '20:00'],
        frequency: { type: 'daily' as const },
        startDate: '2026-11-15',
        endDate: null,
        notes: 'Take after meals',
        active: true,
      };
      const result = medicationInputSchema.safeParse(validMedication);
      expect(result.success).toBe(true);
    });

    it('accepts valid weekdays medication schedule', () => {
      const validWeekdays = {
        name: 'Physiotherapy Vitamin D',
        dosage: '1000 IU',
        times: ['09:00'],
        frequency: { type: 'weekdays' as const, days: [1, 3, 5] },
        startDate: '2026-11-01',
        endDate: '2026-12-01',
        notes: 'Mon, Wed, Fri',
        active: true,
      };
      const result = medicationInputSchema.safeParse(validWeekdays);
      expect(result.success).toBe(true);
    });

    it('rejects medication with invalid time format', () => {
      const invalidTime = {
        name: 'Metformin',
        dosage: '500 mg',
        times: ['8am', '25:00'], // Invalid 24-hr format
        frequency: { type: 'daily' as const },
        startDate: '2026-11-15',
        endDate: null,
        notes: '',
        active: true,
      };
      const result = medicationInputSchema.safeParse(invalidTime);
      expect(result.success).toBe(false);
    });

    it('rejects medication with empty name or excessive dosage length', () => {
      const invalid = {
        name: '',
        dosage: 'A'.repeat(100), // Max is 80
        times: ['08:00'],
        frequency: { type: 'daily' as const },
        startDate: '2026-11-15',
        endDate: null,
        notes: '',
        active: true,
      };
      const result = medicationInputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('AppointmentInput Schema', () => {
    it('accepts valid appointment details', () => {
      const valid = {
        doctorName: 'Dr. Asha Sharma',
        specialty: 'Cardiologist',
        dateTime: '2026-11-20T10:30:00+05:30',
        location: 'Apollo Care Center, Clinic 3',
        notes: 'Bring recent ECG reports',
      };
      const result = appointmentInputSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects appointment with empty doctor name or invalid date format', () => {
      const invalid = {
        doctorName: '   ',
        specialty: 'General Physician',
        dateTime: 'tomorrow morning at 10am',
        location: 'City Hospital',
        notes: '',
      };
      const result = appointmentInputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
