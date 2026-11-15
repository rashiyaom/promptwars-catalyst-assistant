/** Roles available in a shared Sanjeevani care profile. */
export type MemberRole = 'elder' | 'caretaker' | 'family' | 'doctor';

/** Public profile summary shared with authorized members. */
export interface CareProfile {
  readonly id: string;
  readonly elderName: string;
  readonly timezone: string;
  readonly graceMinutes: number;
  /** Creator owns access management; care permissions still come from membership. */
  readonly ownerUid?: string;
  /** Optional login belonging to this elder, separate from the elder record itself. */
  readonly elderUid?: string | null;
  readonly relationship?: 'self' | 'parent' | 'relative' | 'other';
}

/** Authenticated member linked to a care profile. */
export interface CareMember {
  readonly uid: string;
  readonly role: MemberRole;
  readonly displayName: string;
  readonly email: string;
  readonly joinedAt: string;
}

/** Private account record; never stores a global self-assigned care role. */
export interface CareAccount {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
}

/** Safe invitation metadata; the secret token is only returned at creation. */
export interface CareInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: MemberRole;
  readonly status: 'pending' | 'accepted' | 'revoked';
  readonly expiresAt: string;
}
