import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { Medication, MedicationFrequency } from '@sanjeevani/shared/types/medication';
import type { Appointment } from '@sanjeevani/shared/types/appointment';
import type { CareMember, CareProfile, MemberRole } from '@sanjeevani/shared/types/profile';
import type { MedicationInput } from '@sanjeevani/shared/schemas/medication';
import type { AppointmentInput } from '@sanjeevani/shared/schemas/appointment';
import { getFirebaseClients } from '../lib/firebase.js';
import * as medService from '../features/medications/medicationService.js';
import * as apptService from '../features/appointments/appointmentService.js';
import * as profService from '../features/profiles/profileService.js';

export interface ExtendedMedication extends Medication {
  readonly status?: 'pending' | 'taken' | 'skipped';
  readonly actionTime?: string;
}

export interface CareContextValue {
  readonly activeProfile: CareProfile;
  readonly role: MemberRole;
  readonly isElderMode: boolean;
  readonly isLiveConnected: boolean;
  readonly medications: readonly ExtendedMedication[];
  readonly appointments: readonly Appointment[];
  readonly careMembers: readonly CareMember[];
  readonly adherenceScore: { readonly taken: number; readonly total: number; readonly percentage: number };
  setRole: (role: MemberRole) => void;
  toggleElderMode: () => void;
  speakText: (text: string) => void;
  addMedication: (input: MedicationInput) => Promise<void>;
  updateMedication: (id: string, input: MedicationInput) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  logDose: (id: string, status: 'taken' | 'skipped') => Promise<void>;
  addAppointment: (input: AppointmentInput) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const DEFAULT_PROFILE: CareProfile = {
  id: 'profile-dadaji-primary',
  elderName: 'Dadaji (Shri Rameshwar)',
  timezone: 'Asia/Kolkata',
  graceMinutes: 30,
};

const INITIAL_MEMBERS: CareMember[] = [
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

const INITIAL_MEDICATIONS: ExtendedMedication[] = [
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
    status: 'taken',
    actionTime: '08:05 AM',
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
    status: 'pending',
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
    status: 'pending',
  },
];

const INITIAL_APPOINTMENTS: Appointment[] = [
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

const CareContext = createContext<CareContextValue | null>(null);

export function CareProvider({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  const [activeProfile] = useState<CareProfile>(DEFAULT_PROFILE);
  const [role, setRole] = useState<MemberRole>('elder');
  const [isElderMode, setIsElderMode] = useState<boolean>(false);
  const [medications, setMedications] = useState<ExtendedMedication[]>(INITIAL_MEDICATIONS);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [careMembers, setCareMembers] = useState<CareMember[]>(INITIAL_MEMBERS);

  const clients = getFirebaseClients();
  const isLiveConnected = Boolean(clients && !clients.auth.currentUser?.isAnonymous);

  const refreshData = async (): Promise<void> => {
    if (!clients || !clients.auth.currentUser) return;
    try {
      const [fetchedMeds, fetchedAppts, fetchedMembers] = await Promise.all([
        medService.listMedications(activeProfile.id),
        apptService.listAppointments(activeProfile.id),
        profService.listCareMembers(activeProfile.id),
      ]);
      if (fetchedMeds.length > 0) setMedications(fetchedMeds);
      if (fetchedAppts.length > 0) setAppointments(fetchedAppts);
      if (fetchedMembers.length > 0) setCareMembers(fetchedMembers);
    } catch (err) {
      console.warn('Using offline data fallback:', err);
    }
  };

  useEffect(() => {
    if (isLiveConnected) {
      void refreshData();
    }
  }, [isLiveConnected]);

  const adherenceScore = useMemo(() => {
    const total = medications.length;
    const taken = medications.filter((m) => m.status === 'taken').length;
    const percentage = total > 0 ? Math.round((taken / total) * 100) : 100;
    return { taken, total, percentage };
  }, [medications]);

  const toggleElderMode = () => setIsElderMode((prev) => !prev);

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower pace for elders
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const addMedication = async (input: MedicationInput): Promise<void> => {
    if (isLiveConnected) {
      const newId = await medService.addMedication(activeProfile.id, input);
      setMedications((prev) => [...prev, { id: newId, ...input, status: 'pending' }]);
    } else {
      const newMed: ExtendedMedication = {
        id: `med-${Date.now()}`,
        name: input.name,
        dosage: input.dosage,
        times: input.times,
        frequency: input.frequency as MedicationFrequency,
        startDate: input.startDate,
        endDate: input.endDate,
        notes: input.notes,
        active: input.active,
        status: 'pending',
      };
      setMedications((prev) => [...prev, newMed]);
    }
  };

  const updateMedication = async (id: string, input: MedicationInput): Promise<void> => {
    if (isLiveConnected) {
      await medService.updateMedication(activeProfile.id, id, input);
    }
    setMedications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...input } : item)),
    );
  };

  const deleteMedication = async (id: string): Promise<void> => {
    if (isLiveConnected) {
      await medService.deleteMedication(activeProfile.id, id);
    }
    setMedications((prev) => prev.filter((item) => item.id !== id));
  };

  const logDose = async (id: string, status: 'taken' | 'skipped'): Promise<void> => {
    const nowTime = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    if (isLiveConnected) {
      await medService.logDose(activeProfile.id, id, status);
    }
    setMedications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status, actionTime: nowTime } : item,
      ),
    );
  };

  const addAppointment = async (input: AppointmentInput): Promise<void> => {
    if (isLiveConnected) {
      const newId = await apptService.addAppointment(activeProfile.id, input);
      setAppointments((prev) => [...prev, { id: newId, ...input }]);
    } else {
      const newAppt: Appointment = {
        id: `appt-${Date.now()}`,
        doctorName: input.doctorName,
        specialty: input.specialty,
        dateTime: input.dateTime,
        location: input.location,
        notes: input.notes,
      };
      setAppointments((prev) => [...prev, newAppt]);
    }
  };

  const deleteAppointment = async (id: string): Promise<void> => {
    if (isLiveConnected) {
      await apptService.deleteAppointment(activeProfile.id, id);
    }
    setAppointments((prev) => prev.filter((item) => item.id !== id));
  };

  const contextValue = useMemo<CareContextValue>(
    () => ({
      activeProfile,
      role,
      isElderMode,
      isLiveConnected,
      medications,
      appointments,
      careMembers,
      adherenceScore,
      setRole,
      toggleElderMode,
      speakText,
      addMedication,
      updateMedication,
      deleteMedication,
      logDose,
      addAppointment,
      deleteAppointment,
      refreshData,
    }),
    [activeProfile, role, isElderMode, isLiveConnected, medications, appointments, careMembers, adherenceScore],
  );

  return <CareContext.Provider value={contextValue}>{children}</CareContext.Provider>;
}

export function useCare(): CareContextValue {
  const context = useContext(CareContext);
  if (!context) {
    throw new Error('useCare must be used within a CareProvider');
  }
  return context;
}
