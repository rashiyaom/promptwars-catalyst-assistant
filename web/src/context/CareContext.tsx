import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.js';
import { carePermissions } from '@sanjeevani/shared/types/access';
import type { ElderProfileInput } from '@sanjeevani/shared/schemas/profile';
import * as alertService from '../features/profiles/notificationSettingsService.js';
import { nextSnoozeTime } from '@sanjeevani/shared/types/taus';
import type { User } from 'firebase/auth';
import type { Medication } from '@sanjeevani/shared/types/medication';
import type { DoseLog } from '@sanjeevani/shared/types/doseLog';
import type { Appointment } from '@sanjeevani/shared/types/appointment';
import type { CareMember, CareProfile, MemberRole } from '@sanjeevani/shared/types/profile';
import { medicationInputSchema, type MedicationInput } from '@sanjeevani/shared/schemas/medication';
import { appointmentInputSchema, type AppointmentInput } from '@sanjeevani/shared/schemas/appointment';
import { getFirebaseClients } from '../lib/firebase.js';
import { ensureCareAccount, signOutMember, subscribeToAuth } from '../features/auth/authService.js';
import * as medService from '../features/medications/medicationService.js';
import * as apptService from '../features/appointments/appointmentService.js';
import * as profService from '../features/profiles/profileService.js';
import { addDays, localDate, scheduledDoses } from '../features/medications/schedule.js';
import { DEFAULT_PROFILE, INITIAL_APPOINTMENTS, INITIAL_MEDICATIONS, INITIAL_MEMBERS } from './demoData.js';

interface ProfileData {
  activeProfile: CareProfile;
  role: MemberRole;
  medications: Medication[];
  appointments: Appointment[];
  careMembers: CareMember[];
  doseLogs: DoseLog[];
}

export interface CareContextValue extends ProfileData {
  readonly user: User | null;
  readonly isDemo: boolean;
  readonly isElderMode: boolean;
  readonly isLiveConnected: boolean;
  readonly loading: boolean;
  readonly dataError: string | null;
  readonly profiles: readonly CareProfile[];
  readonly today: string;
  readonly todayDoses: readonly DoseLog[];
  readonly canManageMedication: boolean;
  readonly canLogDose: boolean;
  readonly authReady: boolean;
  readonly demoActive: boolean;
  snoozeDose: (dose: DoseLog) => Promise<string>;
  readonly canEdit: boolean;
  readonly currentMember: CareMember | null;
  readonly adherenceScore: { readonly taken: number; readonly total: number; readonly percentage: number };
  signInAsMember: (member: CareMember) => void;
  signOutCurrentMember: () => Promise<void>;
  setRole: (role: MemberRole) => void;
  toggleElderMode: () => void;
  speakText: (text: string) => void;
  addMedication: (input: MedicationInput) => Promise<void>;
  updateMedication: (id: string, input: MedicationInput) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  logDose: (dose: DoseLog, status: 'taken' | 'skipped') => Promise<void>;
  addAppointment: (input: AppointmentInput) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  refreshProfiles: (preferredId?: string) => Promise<void>;
  switchProfile: (id: string) => Promise<void>;
  createDemoProfile: (input: ElderProfileInput) => CareProfile;
}

const EMPTY_PROFILE: CareProfile = { id: '', elderName: 'Choose a care profile', timezone: 'Asia/Kolkata', graceMinutes: 30 };
const EMPTY_DATA: ProfileData = { activeProfile: EMPTY_PROFILE, role: 'family', medications: [], appointments: [], careMembers: [], doseLogs: [] };

/** Seed a labeled, deterministic sample week relative to the current profile date. */
function demoData(): ProfileData {
  const today = localDate(new Date(), DEFAULT_PROFILE.timezone);
  const medications = INITIAL_MEDICATIONS.map((med) => ({ ...med, startDate: addDays(today, -30) }));
  const doseLogs = Array.from({ length: 7 }, (_, index) => scheduledDoses(medications, addDays(today, index - 6), DEFAULT_PROFILE.timezone)
    .map((dose, doseIndex): DoseLog => ({ ...dose, status: index === 6 ? 'pending' : (index + doseIndex) % 7 === 0 ? 'missed' : 'taken' }))).flat();
  const appointments = INITIAL_APPOINTMENTS.map((appt, index) => ({ ...appt, dateTime: `${addDays(today, 5 + index * 14)}T10:30:00+05:30` }));
  return { activeProfile: DEFAULT_PROFILE, role: 'elder', medications, appointments, careMembers: INITIAL_MEMBERS, doseLogs };
}

const CareContext = createContext<CareContextValue | null>(null);

/** Observe Firebase identity and discard profile state on account changes. */
export function CareProvider({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  const [identity, setIdentity] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: getFirebaseClients() === null });
  useEffect(() => subscribeToAuth((user) => setIdentity({ user, ready: true })), []);
  return <CareSession key={identity.user?.emailVerified ? identity.user.uid : 'signed-out'} user={identity.user} authReady={identity.ready}>{children}</CareSession>;
}

/** Own profile-scoped data, preserving offline operation and server-enforced roles. */
function CareSession({ children, user, authReady }: { readonly children: React.ReactNode; readonly user: User | null; readonly authReady: boolean }): React.JSX.Element {
  const { locale } = useLanguage();
  const isDemo = getFirebaseClients() === null;
  const isLiveConnected = !isDemo && Boolean(user?.emailVerified && !user.isAnonymous);
  const [demoActive, setDemoActive] = useState(false);
  const [data, setData] = useState<ProfileData>(() => isDemo ? demoData() : EMPTY_DATA);
  const [currentMember, setCurrentMember] = useState<CareMember | null>(() => isDemo ? INITIAL_MEMBERS[0] : null);
  const [profiles, setProfiles] = useState<CareProfile[]>(() => isDemo ? [DEFAULT_PROFILE] : []);
  const [isElderMode, setIsElderMode] = useState(false);
  const [loading, setLoading] = useState(isLiveConnected);
  const [dataError, setDataError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const requestVersion = useRef(0);
  const demoProfiles = useRef(new Map<string, ProfileData>());
  const dataRef = useRef(data);
  dataRef.current = data;
  const { activeProfile, medications, doseLogs, role } = data;
  const today = localDate(now, activeProfile.timezone);
  const todayDoses = scheduledDoses(medications, today, activeProfile.timezone).map((dose) => doseLogs.find((log) => log.id === dose.id) ?? dose);
  const taken = todayDoses.filter((dose) => dose.status === 'taken').length;
  const accessible = Boolean(activeProfile.id) && !loading && (isDemo || isLiveConnected);
  const permissions = carePermissions(role);
  const canEdit = accessible && permissions.manageAppointments;
  const canManageMedication = accessible && permissions.manageMedication;
  const canLogDose = accessible && permissions.logDose;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const switchProfile = async (id: string): Promise<void> => {
    if (isDemo) {
      demoProfiles.current.set(dataRef.current.activeProfile.id, dataRef.current);
      const saved = demoProfiles.current.get(id);
      if (saved) setData(saved);
      return;
    }
    const version = ++requestVersion.current;
    setLoading(true);
    setDataError(null);
    if (dataRef.current.activeProfile.id !== id) setData(EMPTY_DATA);
    try {
      const [profile, memberRole, meds, appts, members, logs] = await Promise.all([
        profService.getCareProfile(id), profService.getMyProfileRole(id), medService.listMedications(id),
        apptService.listAppointments(id), profService.listCareMembers(id), medService.listDoseLogs(id),
      ]);
      if (!profile || !memberRole) throw new Error('This account does not have access to that profile.');
      new Intl.DateTimeFormat('en', { timeZone: profile.timezone }).format();
      if (version === requestVersion.current) setData({ activeProfile: profile, role: memberRole, medications: meds, appointments: appts, careMembers: members, doseLogs: logs });
    } catch (error) {
      if (version === requestVersion.current) { setData(EMPTY_DATA); setDataError(error instanceof Error ? error.message : 'Could not load profile. Please retry.'); }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  const refreshProfiles = async (preferredId?: string): Promise<void> => {
    if (!isLiveConnected) return;
    setLoading(true);
    setDataError(null);
    try {
      await ensureCareAccount();
      const found = await profService.listMyCareProfiles();
      setProfiles(found);
      const selected = found.find((profile) => profile.id === (preferredId ?? dataRef.current.activeProfile.id)) ?? found[0];
      if (selected) await switchProfile(selected.id);
      else setData(EMPTY_DATA);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Could not load care profiles. Please retry.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (isLiveConnected) void refreshProfiles();
    return () => { requestVersion.current += 1; };
  }, [isLiveConnected]);

  /** Apply an async result only to the profile that initiated the operation. */
  const changeData = (profileId: string, change: (previous: ProfileData) => ProfileData) => {
    setData((previous) => previous.activeProfile.id === profileId ? change(previous) : previous);
  };
  const requireEdit = (medication = false) => {
    if (!(medication ? canManageMedication : canEdit)) throw new Error('Select a profile with the required access before making changes.');
  };
  const addMedication = async (input: MedicationInput) => {
    requireEdit(true);
    const parsed = medicationInputSchema.parse(input);
    const id = isDemo ? crypto.randomUUID() : await medService.addMedication(activeProfile.id, parsed);
    changeData(activeProfile.id, (previous) => ({ ...previous, medications: [...previous.medications, { id, ...parsed }] }));
  };
  const updateMedication = async (id: string, input: MedicationInput) => {
    requireEdit(true);
    const parsed = medicationInputSchema.parse(input);
    if (!isDemo) await medService.updateMedication(activeProfile.id, id, parsed);
    changeData(activeProfile.id, (previous) => ({ ...previous, medications: previous.medications.map((item) => item.id === id ? { ...item, ...parsed } : item) }));
  };
  const deleteMedication = async (id: string) => {
    requireEdit(true);
    if (!isDemo) await medService.deleteMedication(activeProfile.id, id);
    changeData(activeProfile.id, (previous) => ({ ...previous, medications: previous.medications.filter((item) => item.id !== id) }));
  };
  const logDose = async (dose: DoseLog, status: 'taken' | 'skipped') => {
    if (!canLogDose) throw new Error('Only the elder or caretaker may record doses.');
    if (dose.status !== 'pending' && dose.status !== 'missed') throw new Error('This dose has already been recorded.');
    if (!isDemo) await medService.logDose(activeProfile.id, dose.id, status);
    const logged: DoseLog = { ...dose, status, loggedAt: new Date().toISOString(), loggedBy: user?.uid ?? 'demo-member' };
    changeData(activeProfile.id, (previous) => ({ ...previous, doseLogs: [...previous.doseLogs.filter((item) => item.id !== dose.id), logged] }));
  };
  const addAppointment = async (input: AppointmentInput) => {
    requireEdit();
    const parsed = appointmentInputSchema.parse(input);
    const id = isDemo ? crypto.randomUUID() : await apptService.addAppointment(activeProfile.id, parsed);
    changeData(activeProfile.id, (previous) => ({ ...previous, appointments: [...previous.appointments, { id, ...parsed }].sort((a, b) => a.dateTime.localeCompare(b.dateTime)) }));
  };
  const deleteAppointment = async (id: string) => {
    requireEdit();
    if (!isDemo) await apptService.deleteAppointment(activeProfile.id, id);
    changeData(activeProfile.id, (previous) => ({ ...previous, appointments: previous.appointments.filter((item) => item.id !== id) }));
  };
  const createDemoProfile = (input: ElderProfileInput): CareProfile => {
    if (!isDemo) throw new Error('Demo profiles are only available in offline mode.');
    const uid = currentMember?.uid ?? 'demo-member';
    const ownerRole = input.relationship === 'self' ? 'elder' : 'caretaker';
    const profile = { id: crypto.randomUUID(), ...input, ownerUid: uid, elderUid: ownerRole === 'elder' ? uid : null, graceMinutes: 30 };
    demoProfiles.current.set(activeProfile.id, dataRef.current);
    const member: CareMember = { uid, role: ownerRole, displayName: currentMember?.displayName ?? input.elderName, email: currentMember?.email ?? '', joinedAt: new Date().toISOString() };
    const next: ProfileData = { ...EMPTY_DATA, activeProfile: profile, role: ownerRole, careMembers: [member] };
    demoProfiles.current.set(profile.id, next);
    setProfiles((previous) => [...previous, profile]);
    setCurrentMember(member); setData(next);
    return profile;
  };
  const snoozeDose = async (dose: DoseLog): Promise<string> => {
    if (!canLogDose) throw new Error('Only the elder or caretaker may record doses.');
    let nextReminderAt: string;
    if (isDemo) {
      const next = nextSnoozeTime(Date.parse(dose.scheduledFor), activeProfile.graceMinutes, dose.snoozeCount ?? 0, dose.status, Date.now());
      if (next === null) throw new Error('This dose needs care-circle follow-up; its escalation deadline cannot be delayed.');
      nextReminderAt = new Date(next).toISOString();
    } else nextReminderAt = (await alertService.snoozeDose(activeProfile.id, dose.id)).nextReminderAt;
    changeData(activeProfile.id, (previous) => ({ ...previous, doseLogs: [...previous.doseLogs.filter((log) => log.id !== dose.id), { ...dose, nextReminderAt, snoozeCount: (dose.snoozeCount ?? 0) + 1 }] }));
    return nextReminderAt;
  };
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const signInAsMember = (member: CareMember) => {
    if (!isDemo) return;
    setDemoActive(true);
    setCurrentMember(member);
    setData((previous) => ({ ...previous, role: member.role }));
  };

  const signOutCurrentMember = async () => {
    if (!isDemo && user) {
      await signOutMember();
    }
    setDemoActive(false);
    setCurrentMember(null);
  };

  return <CareContext.Provider value={{ ...data, user, authReady, demoActive, canLogDose, snoozeDose, isDemo, isLiveConnected, isElderMode, loading, dataError, profiles, today, todayDoses, canEdit, canManageMedication, currentMember: isDemo ? currentMember : data.careMembers.find((member) => member.uid === user?.uid) ?? null,
    adherenceScore: { taken, total: todayDoses.length, percentage: todayDoses.length ? Math.round(taken / todayDoses.length * 100) : 0 },
    signInAsMember, signOutCurrentMember,
    setRole: (next) => { if (isDemo) setData((previous) => ({ ...previous, role: next })); },
    toggleElderMode: () => setIsElderMode((previous) => !previous), speakText,
    addMedication, updateMedication, deleteMedication, logDose, addAppointment, deleteAppointment,
    refreshData: () => switchProfile(activeProfile.id), refreshProfiles, switchProfile, createDemoProfile,
  }}>{children}</CareContext.Provider>;
}

/** Access care data inside the provider. */
export function useCare(): CareContextValue {
  const context = useContext(CareContext);
  if (!context) throw new Error('useCare must be used within a CareProvider');
  return context;
}
