import type { MemberRole } from './profile.js';

/** Profile-specific roles: membership never grants access to another elder. */
export const MEMBER_ROLES = ['elder', 'caretaker', 'family', 'doctor'] as const;
export function isMemberRole(value: unknown): value is MemberRole {
  return MEMBER_ROLES.some((role) => role === value);
}

/** Mirrors Firestore rules; ownership is a separate server-controlled relation. */
export function carePermissions(role: MemberRole) {
  return {
    manageMedication: role === 'elder' || role === 'caretaker' || role === 'doctor',
    logDose: role === 'elder' || role === 'caretaker',
    manageAppointments: role === 'elder' || role === 'caretaker' || role === 'doctor',
  };
}
