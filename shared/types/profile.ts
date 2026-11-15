/** Roles available in a shared Sanjeevani care profile. */
export type MemberRole = 'elder' | 'caretaker' | 'family';

/** Public profile summary shared with authorized members. */
export interface CareProfile {
  readonly id: string;
  readonly elderName: string;
  readonly timezone: string;
  readonly graceMinutes: number;
}

/** Authenticated member linked to a care profile. */
export interface CareMember {
  readonly uid: string;
  readonly role: MemberRole;
  readonly displayName: string;
  readonly email: string;
  readonly joinedAt: string;
}
