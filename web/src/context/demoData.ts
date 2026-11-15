import type { Medication } from '@sanjeevani/shared/types/medication';
import type { Appointment } from '@sanjeevani/shared/types/appointment';
import type { CareMember, CareProfile } from '@sanjeevani/shared/types/profile';

export const DEFAULT_PROFILE: CareProfile = {
  id: 'profile-dadaji-primary',
  elderName: 'Dadaji (Shri Rameshwar)',
  timezone: 'Asia/Kolkata',
  graceMinutes: 30,
};

export const INITIAL_MEMBERS: CareMember[] = [
  {
    uid: 'user-elder-1',
    role: 'elder',
    displayName: 'Rameshwar Sharma (Dadaji)',
    email: 'rameshwar.sharma@example.com',
    joinedAt: '2026-11-01T08:00:00Z',
  },
  {
    uid: 'user-caretaker-1',
    role: 'caretaker',
    displayName: 'Priya Sharma (Primary Caregiver)',
    email: 'priya.care@example.com',
    joinedAt: '2026-11-01T08:15:00Z',
  },
  {
    uid: 'user-family-1',
    role: 'family',
    displayName: 'Rohan Sharma (Grandson)',
    email: 'rohan.sharma@example.com',
    joinedAt: '2026-11-02T10:30:00Z',
  },
];

export const INITIAL_MEDICATIONS: Medication[] = [
  {
    id: 'med-1',
    name: 'Amlodipine',
    dosage: '5 mg oral tablet',
    times: ['08:00'],
    frequency: { type: 'daily' },
    startDate: '2026-11-01',
    endDate: null,
    notes: 'Take after breakfast for blood pressure.',
    active: true,
  },
  {
    id: 'med-2',
    name: 'Metformin',
    dosage: '500 mg oral tablet',
    times: ['13:00', '20:00'],
    frequency: { type: 'daily' },
    startDate: '2026-11-01',
    endDate: null,
    notes: 'Take with or right after meals for diabetes management.',
    active: true,
  },
  {
    id: 'med-3',
    name: 'Atorvastatin',
    dosage: '20 mg oral tablet',
    times: ['21:00'],
    frequency: { type: 'daily' },
    startDate: '2026-11-01',
    endDate: null,
    notes: 'Take before bedtime for cholesterol.',
    active: true,
  },
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'appt-1',
    doctorName: 'Dr. Asha Sharma',
    specialty: 'Cardiologist',
    dateTime: '2026-11-20T10:30:00+05:30',
    location: 'Apollo Care Center, Clinic 304',
    notes: 'Routine blood pressure review. Bring 2-week BP tracking log.',
  },
  {
    id: 'appt-2',
    doctorName: 'Dr. Vikram Patel',
    specialty: 'Ophthalmologist',
    dateTime: '2026-12-05T15:00:00+05:30',
    location: 'City Eye Hospital, 2nd Floor',
    notes: 'Annual diabetic retinopathy eye checkup.',
  },
];

