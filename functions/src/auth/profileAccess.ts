import { randomBytes, randomUUID } from 'node:crypto';
import { compare } from 'bcryptjs';
import { initializeApp, getApps } from 'firebase-admin/app';
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentReference,
} from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { loadFunctionConfig } from '../config.js';
import {
  requireIdentity,
  assertOwner,
  assertInvitation,
  tokenHash,
  elderProfileSchema,
  inviteSchema,
  acceptSchema,
  revokeInviteSchema,
  memberChangeSchema,
  INVITATION_LIFETIME_MS,
} from './accessPolicy.js';

const adminApp = getApps()[0] ?? initializeApp();
const database = getFirestore(adminApp);
const FUNCTION_OPTIONS = {
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 2,
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
};
const MAX_PASSCODE_FAILURES = 5;
const PASSCODE_LOCK_MS = 15 * 60 * 1000;

const joinProfileSchema = z.object({
  profileId: z.string().uuid(),
  passcode: z.string().regex(/^\d{6,12}$/),
  displayName: z.string().trim().min(1).max(100),
});

type MemberRole = 'elder' | 'caretaker' | 'family';

/** Build the private profile reference used only by the Admin SDK. */
function accessReference(profileId: string): DocumentReference {
  return database.doc(`profiles/${profileId}/private/access`);
}

/** Upsert a private account from verified identity claims; care roles are never global. */
export const ensureCareAccount = onCall(FUNCTION_OPTIONS, async (request) => {
  const identity = requireIdentity(request);
  const reference = database.doc(`users/${identity.uid}`);
  await database.runTransaction(async (tx) => {
    const existing = await tx.get(reference);
    tx.set(
      reference,
      {
        ...identity,
        updatedAt: FieldValue.serverTimestamp(),
        ...(!existing.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
      },
      { merge: true },
    );
  });
  return identity;
});

/** An account creates an elder record; the elder need not have their own login yet. */
export const createCareProfile = onCall(FUNCTION_OPTIONS, async (request) => {
  const identity = requireIdentity(request);
  const input = elderProfileSchema.safeParse(request.data);
  if (!input.success)
    throw new HttpsError('invalid-argument', 'Check the elder name, relationship and timezone.');
  const profileId = randomUUID();
  const role = input.data.relationship === 'self' ? 'elder' : 'caretaker';
  const profile = {
    ...input.data,
    ownerUid: identity.uid,
    createdBy: identity.uid,
    elderUid: role === 'elder' ? identity.uid : null,
    accessMode: 'invitation',
    schemaVersion: 2,
    graceMinutes: loadFunctionConfig().graceMinutes,
    createdAt: FieldValue.serverTimestamp(),
  };
  const batch = database.batch();
  batch.create(database.doc(`profiles/${profileId}`), profile);
  batch.create(database.doc(`profiles/${profileId}/members/${identity.uid}`), {
    ...identity,
    role,
    joinedAt: FieldValue.serverTimestamp(),
  });
  batch.create(database.doc(`users/${identity.uid}/profiles/${profileId}`), {
    profileId,
    elderName: profile.elderName,
    timezone: profile.timezone,
    graceMinutes: profile.graceMinutes,
    ownerUid: identity.uid,
    role,
  });
  batch.set(
    database.doc(`users/${identity.uid}`),
    { ...identity, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  await batch.commit();
  return { profileId, role };
});

/** Owner creates an email-bound, single-use invitation. Only a digest is stored. */
export const createCareInvitation = onCall(FUNCTION_OPTIONS, async (request) => {
  const identity = requireIdentity(request);
  const parsed = inviteSchema.safeParse(request.data);
  if (!parsed.success)
    throw new HttpsError('invalid-argument', 'Check the invitation email and role.');
  const { profileId, email, role } = parsed.data;
  if (email === identity.email)
    throw new HttpsError('invalid-argument', 'You cannot invite yourself into a different role.');
  const invitationId = randomUUID();
  const token = randomBytes(32).toString('hex');
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITATION_LIFETIME_MS);
  const profileRef = database.doc(`profiles/${profileId}`);
  await database.runTransaction(async (tx) => {
    const [profile, member] = await Promise.all([
      tx.get(profileRef),
      tx.get(profileRef.collection('members').doc(identity.uid)),
    ]);
    assertOwner(profile.data(), identity, member.exists);
    if (role === 'elder' && profile.get('elderUid'))
      throw new HttpsError('already-exists', 'This elder is already linked to an account.');
    tx.create(profileRef.collection('invitations').doc(invitationId), {
      email,
      role,
      tokenHash: tokenHash(token),
      status: 'pending',
      createdBy: identity.uid,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });
    // Older profiles become invitation-only when the owner starts using this access model.
    tx.update(profileRef, { accessMode: 'invitation' });
    tx.create(profileRef.collection('auditEvents').doc(), {
      action: 'invitation.created',
      actorUid: identity.uid,
      invitationId,
      role,
      at: FieldValue.serverTimestamp(),
    });
  });
  return { profileId, invitationId, token, expiresAt: expiresAt.toDate().toISOString() };
});

/** Acceptance atomically connects the account and elder in both directions. */
export const acceptCareInvitation = onCall(FUNCTION_OPTIONS, async (request) => {
  const identity = requireIdentity(request);
  const parsed = acceptSchema.safeParse(request.data);
  if (!parsed.success)
    throw new HttpsError('invalid-argument', 'Use the complete invitation link.');
  const { profileId, invitationId, token } = parsed.data;
  const profileRef = database.doc(`profiles/${profileId}`);
  return database.runTransaction(async (tx) => {
    const invitationRef = profileRef.collection('invitations').doc(invitationId);
    const memberRef = profileRef.collection('members').doc(identity.uid);
    const [profile, invitation, existing] = await Promise.all([
      tx.get(profileRef),
      tx.get(invitationRef),
      tx.get(memberRef),
    ]);
    if (!profile.exists || !invitation.exists)
      throw new HttpsError('not-found', 'The invitation could not be found.');
    const previousOwner = profile.get('ownerUid') ?? profile.get('createdBy');
    if (invitation.get('createdBy') !== previousOwner)
      throw new HttpsError(
        'permission-denied',
        'Ask the current profile owner for a new invitation.',
      );
    const role = assertInvitation(
      invitation.data() ?? {},
      identity,
      token,
      invitation.get('expiresAt') instanceof Timestamp
        ? invitation.get('expiresAt').toMillis()
        : NaN,
      Date.now(),
    );
    if (existing.exists)
      throw new HttpsError('already-exists', 'This account already belongs to the care profile.');
    if (role === 'elder' && profile.get('elderUid'))
      throw new HttpsError('already-exists', 'This elder already has a linked account.');
    // Once a self-registered elder connects a caretaker, access administration
    // belongs to that caretaker. Old owner-issued pending links stop working.
    const handoff = role === 'caretaker' && profile.get('elderUid') === previousOwner;
    tx.create(memberRef, { ...identity, role, joinedAt: FieldValue.serverTimestamp() });
    tx.create(database.doc(`users/${identity.uid}/profiles/${profileId}`), {
      profileId,
      role,
      elderName: profile.get('elderName'),
      timezone: profile.get('timezone'),
      graceMinutes: profile.get('graceMinutes'),
      ownerUid: handoff ? identity.uid : previousOwner,
    });
    if (handoff) {
      tx.update(profileRef, { ownerUid: identity.uid });
      tx.set(
        database.doc(`users/${previousOwner}/profiles/${profileId}`),
        { ownerUid: identity.uid },
        { merge: true },
      );
      tx.create(profileRef.collection('auditEvents').doc(), {
        action: 'ownership.caretaker_handoff',
        actorUid: identity.uid,
        previousOwner,
        at: FieldValue.serverTimestamp(),
      });
    }
    if (role === 'elder') tx.update(profileRef, { elderUid: identity.uid });
    tx.update(invitationRef, {
      status: 'accepted',
      acceptedBy: identity.uid,
      acceptedAt: FieldValue.serverTimestamp(),
    });
    tx.create(profileRef.collection('auditEvents').doc(), {
      action: 'invitation.accepted',
      actorUid: identity.uid,
      invitationId,
      role,
      at: FieldValue.serverTimestamp(),
    });
    return { profileId, role };
  });
});

/** Revoke a pending link; a used invitation cannot be recycled. */
export const revokeCareInvitation = onCall(FUNCTION_OPTIONS, async (request) => {
  const identity = requireIdentity(request);
  const parsed = revokeInviteSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid invitation.');
  const profileRef = database.doc(`profiles/${parsed.data.profileId}`);
  const inviteRef = profileRef.collection('invitations').doc(parsed.data.invitationId);
  await database.runTransaction(async (tx) => {
    const [profile, member, invitation] = await Promise.all([
      tx.get(profileRef),
      tx.get(profileRef.collection('members').doc(identity.uid)),
      tx.get(inviteRef),
    ]);
    assertOwner(profile.data(), identity, member.exists);
    if (!invitation.exists || invitation.get('status') !== 'pending')
      throw new HttpsError('failed-precondition', 'This invitation is no longer pending.');
    tx.update(inviteRef, { status: 'revoked', revokedAt: FieldValue.serverTimestamp() });
  });
  return { success: true };
});

/** Remove membership and its reverse lookup atomically. An owner cannot remove themselves. */
export const removeCareMember = onCall(FUNCTION_OPTIONS, async (request) => {
  const identity = requireIdentity(request);
  const parsed = memberChangeSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid member.');
  const { profileId, memberUid } = parsed.data;
  if (memberUid === identity.uid)
    throw new HttpsError('failed-precondition', 'The owner cannot remove their own membership.');
  const profileRef = database.doc(`profiles/${profileId}`);
  await database.runTransaction(async (tx) => {
    const [profile, owner] = await Promise.all([
      tx.get(profileRef),
      tx.get(profileRef.collection('members').doc(identity.uid)),
    ]);
    assertOwner(profile.data(), identity, owner.exists);
    tx.delete(profileRef.collection('members').doc(memberUid));
    tx.delete(database.doc(`users/${memberUid}/profiles/${profileId}`));
    if (profile.get('elderUid') === memberUid) tx.update(profileRef, { elderUid: null });
    tx.create(profileRef.collection('auditEvents').doc(), {
      action: 'member.removed',
      actorUid: identity.uid,
      memberUid,
      at: FieldValue.serverTimestamp(),
    });
  });
  return { success: true };
});

/** Verify a shared role passcode server-side, with per-account attempt throttling. */
export const joinCareProfile = onCall(FUNCTION_OPTIONS, async (request) => {
  const identity = requireIdentity(request);
  const parsed = joinProfileSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      'invalid-argument',
      'Check the profile ID and enter a 6–12 digit passcode.',
    );
  }

  const input = parsed.data;
  const accessRef = accessReference(input.profileId);
  const attemptsRef = accessRef.collection('passcodeAttempts').doc(identity.uid);
  const existingAttempts = await attemptsRef.get();
  const initialLockTime = Number(existingAttempts.data()?.lockedUntil ?? 0);
  if (initialLockTime > Date.now()) {
    throw new HttpsError('resource-exhausted', 'Too many attempts. Wait before trying again.');
  }

  const profileAccess = await database.doc(`profiles/${input.profileId}`).get();
  if (profileAccess.get('accessMode') === 'invitation')
    throw new HttpsError('failed-precondition', 'Use an email invitation to connect this profile.');
  const accessSnapshot = await accessRef.get();
  if (!accessSnapshot.exists) {
    throw new HttpsError('not-found', 'The profile or passcode could not be verified.');
  }
  const access = accessSnapshot.data() ?? {};
  const candidates: readonly (readonly [MemberRole, unknown])[] = [
    ['elder', access.elderPasscodeHash],
    ['caretaker', access.caretakerPasscodeHash],
    ['family', access.familyPasscodeHash],
  ];
  const matches = await Promise.all(
    candidates.map(async ([, storedHash]) =>
      typeof storedHash === 'string' ? compare(input.passcode, storedHash) : false,
    ),
  );
  const matchedIndex = matches.findIndex(Boolean);
  const matchedCandidate = matchedIndex < 0 ? null : candidates[matchedIndex];
  const matchedRole = matchedCandidate ? matchedCandidate[0] : null;

  const memberRef = database.doc(`profiles/${input.profileId}/members/${identity.uid}`);
  const userProfileRef = database.doc(`users/${identity.uid}/profiles/${input.profileId}`);
  if (!matchedRole) {
    await database.runTransaction(async (transaction) => {
      const attemptSnapshot = await transaction.get(attemptsRef);
      const attemptData = attemptSnapshot.data() ?? {};
      const lockedUntil = Number(attemptData.lockedUntil ?? 0);
      if (lockedUntil > Date.now()) {
        throw new HttpsError('resource-exhausted', 'Too many attempts. Wait before trying again.');
      }
      const failures = Number(attemptData.failures ?? 0) + 1;
      transaction.set(attemptsRef, {
        failures,
        lockedUntil: failures >= MAX_PASSCODE_FAILURES ? Date.now() + PASSCODE_LOCK_MS : 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    throw new HttpsError('permission-denied', 'The profile or passcode could not be verified.');
  }
  const roleToAssign = matchedRole;

  await database.runTransaction(async (transaction) => {
    const [attemptSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(attemptsRef),
      transaction.get(memberRef),
    ]);
    const lockedUntil = Number(attemptSnapshot.data()?.lockedUntil ?? 0);
    if (lockedUntil > Date.now()) {
      throw new HttpsError('resource-exhausted', 'Too many attempts. Wait before trying again.');
    }
    if (memberSnapshot.exists) {
      throw new HttpsError('already-exists', 'This account is already connected to the profile.');
    }
    const profileSnapshot = await transaction.get(database.doc(`profiles/${input.profileId}`));
    if (profileSnapshot.get('accessMode') === 'invitation')
      throw new HttpsError(
        'failed-precondition',
        'Use an email invitation to connect this profile.',
      );
    if (!profileSnapshot.exists) {
      throw new HttpsError('not-found', 'The profile or passcode could not be verified.');
    }
    transaction.create(memberRef, {
      uid: identity.uid,
      role: roleToAssign,
      displayName: input.displayName,
      email: identity.email,
      joinedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(userProfileRef, {
      profileId: input.profileId,
      role: roleToAssign,
      elderName: String(profileSnapshot.get('elderName') ?? 'Care profile'),
      timezone: String(profileSnapshot.get('timezone') ?? 'UTC'),
      graceMinutes: Number(
        profileSnapshot.get('graceMinutes') ?? loadFunctionConfig().graceMinutes,
      ),
      joinedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(attemptsRef, {
      failures: 0,
      lockedUntil: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { role: roleToAssign };
});
