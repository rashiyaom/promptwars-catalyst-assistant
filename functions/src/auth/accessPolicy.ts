import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';

export const PROFILE_ROLES = ['elder', 'caretaker', 'family', 'doctor'] as const;
export type ProfileRole = typeof PROFILE_ROLES[number];
export const INVITATION_LIFETIME_MS = 48 * 60 * 60 * 1000;
export const elderProfileSchema = z.object({
  elderName: z.string().trim().min(1).max(100),
  timezone: z.string().trim().min(1).max(64).refine((value) => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }),
  relationship: z.enum(['self', 'parent', 'relative', 'other']),
}).strict();
export const inviteSchema = z.object({ profileId: z.string().uuid(), email: z.email().trim().toLowerCase().max(254), role: z.enum(PROFILE_ROLES) }).strict();
export const acceptSchema = z.object({ profileId: z.string().uuid(), invitationId: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const memberChangeSchema = z.object({ profileId: z.string().uuid(), memberUid: z.string().min(1).max(128).regex(/^[^/]+$/) }).strict();
export const revokeInviteSchema = z.object({ profileId: z.string().uuid(), invitationId: z.string().uuid() }).strict();

export interface VerifiedIdentity { uid: string; email: string; displayName: string }
/** Callable SDK validates the token signature; this gate requires a verified email identity. */
export function requireIdentity(request: { auth?: { uid: string; token: { email?: unknown; email_verified?: unknown; name?: unknown } } | null }): VerifiedIdentity {
  const auth = request.auth;
  if (!auth?.uid || typeof auth.token.email !== 'string') throw new HttpsError('unauthenticated', 'Sign in with your email account.');
  if (auth.token.email_verified !== true) throw new HttpsError('failed-precondition', 'Verify your email before connecting care profiles.');
  return { uid: auth.uid, email: auth.token.email.toLowerCase(), displayName: typeof auth.token.name === 'string' ? auth.token.name.slice(0, 100) : auth.token.email.split('@')[0] };
}

/** Ownership comes only from a protected profile document, never caller-supplied role data. */
export function assertOwner(profile: { ownerUid?: unknown; createdBy?: unknown } | undefined, identity: VerifiedIdentity, hasMembership: boolean): void {
  if (!profile || !hasMembership || (profile.ownerUid ?? profile.createdBy) !== identity.uid) throw new HttpsError('permission-denied', 'Only the profile owner can manage access.');
}
export function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }

/** Validate the invitation inside the membership transaction so acceptance cannot race revocation. */
export function assertInvitation(invitation: { email?: unknown; status?: unknown; tokenHash?: unknown; role?: unknown }, identity: VerifiedIdentity, token: string, expiresAt: number, now: number): ProfileRole {
  const supplied = Buffer.from(tokenHash(token), 'hex');
  const expected = typeof invitation.tokenHash === 'string' ? Buffer.from(invitation.tokenHash, 'hex') : Buffer.alloc(0);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied) || invitation.email !== identity.email || invitation.status !== 'pending' || !Number.isFinite(expiresAt) || expiresAt <= now || !PROFILE_ROLES.some((role) => role === invitation.role)) {
    throw new HttpsError('permission-denied', 'The invitation is invalid, expired, already used, or belongs to another email.');
  }
  return invitation.role as ProfileRole;
}
