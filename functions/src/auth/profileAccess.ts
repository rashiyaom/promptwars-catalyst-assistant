import { randomUUID } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { initializeApp, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { loadFunctionConfig } from '../config.js';

const adminApp = getApps()[0] ?? initializeApp();
const database = getFirestore(adminApp);
const FUNCTION_OPTIONS = {
  region: 'us-central1',
  maxInstances: 10,
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
};
const BCRYPT_ROUNDS = 12;
const MAX_PASSCODE_FAILURES = 5;
const PASSCODE_LOCK_MS = 15 * 60 * 1000;

const createProfileSchema = z.object({
  elderName: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(100),
  timezone: z.string().trim().min(1).max(64),
  elderPasscode: z.string().regex(/^\d{6,12}$/),
  caretakerPasscode: z.string().regex(/^\d{6,12}$/),
  familyPasscode: z.string().regex(/^\d{6,12}$/),
}).refine(
  (value) => new Set([value.elderPasscode, value.caretakerPasscode, value.familyPasscode]).size === 3,
  { message: 'Each role must use a different passcode.' },
);

const joinProfileSchema = z.object({
  profileId: z.string().uuid(),
  passcode: z.string().regex(/^\d{6,12}$/),
  displayName: z.string().trim().min(1).max(100),
});

type MemberRole = 'elder' | 'caretaker' | 'family';

/** Require an authenticated Firebase member identity before profile operations. */
function requireIdentity(request: { readonly auth?: { readonly uid: string; readonly token: { readonly email?: unknown; readonly email_verified?: unknown } } | null }): {
  uid: string;
  email: string;
} {
  const uid = request.auth?.uid;
  const email = request.auth?.token.email;
  if (!uid || typeof email !== 'string' || !email.includes('@')) {
    throw new HttpsError('unauthenticated', 'Sign in with an email account before joining a care profile.');
  }
  if (request.auth?.token.email_verified !== true) {
    throw new HttpsError('failed-precondition', 'Verify your email address before joining a care profile.');
  }
  return { uid, email };
}

/** Build the private profile reference used only by the Admin SDK. */
function accessReference(profileId: string): DocumentReference {
  return database.doc(`profiles/${profileId}/private/access`);
}

/** Create a profile for the signed-in elder and persist only hashed role codes. */
export const createCareProfile = onCall(FUNCTION_OPTIONS, async (request) => {
  const identity = requireIdentity(request);
  const parsed = createProfileSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Check the profile details and use three different 6–12 digit role passcodes.');
  }

  const input = parsed.data;
  const profileId = randomUUID();
  const [elderPasscodeHash, caretakerPasscodeHash, familyPasscodeHash] = await Promise.all([
    hash(input.elderPasscode, BCRYPT_ROUNDS),
    hash(input.caretakerPasscode, BCRYPT_ROUNDS),
    hash(input.familyPasscode, BCRYPT_ROUNDS),
  ]);
  const profileReference = database.doc(`profiles/${profileId}`);
  const memberReference = profileReference.collection('members').doc(identity.uid);
  const userProfileReference = database.doc(`users/${identity.uid}/profiles/${profileId}`);

  await database.runTransaction(async (transaction) => {
    transaction.create(profileReference, {
      elderName: input.elderName,
      createdBy: identity.uid,
      timezone: input.timezone,
      graceMinutes: loadFunctionConfig().graceMinutes,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.create(memberReference, {
      uid: identity.uid,
      role: 'elder',
      displayName: input.displayName,
      email: identity.email,
      joinedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(userProfileReference, {
      profileId,
      role: 'elder',
      elderName: input.elderName,
      timezone: input.timezone,
      graceMinutes: loadFunctionConfig().graceMinutes,
      joinedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(accessReference(profileId), {
      elderPasscodeHash,
      caretakerPasscodeHash,
      familyPasscodeHash,
    });
  });

  return { profileId, role: 'elder' as const };
});

/** Verify a shared role passcode server-side, with per-account attempt throttling. */
export const joinCareProfile = onCall(FUNCTION_OPTIONS, async (request) => {
  const identity = requireIdentity(request);
  const parsed = joinProfileSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Check the profile ID and enter a 6–12 digit passcode.');
  }

  const input = parsed.data;
  const accessRef = accessReference(input.profileId);
  const attemptsRef = accessRef.collection('passcodeAttempts').doc(identity.uid);
  const existingAttempts = await attemptsRef.get();
  const initialLockTime = Number(existingAttempts.data()?.lockedUntil ?? 0);
  if (initialLockTime > Date.now()) {
    throw new HttpsError('resource-exhausted', 'Too many attempts. Wait before trying again.');
  }

  const accessSnapshot = await accessRef.get();
  if (!accessSnapshot.exists) {
    throw new HttpsError('not-found', 'The profile or passcode could not be verified.');
  }
  const access = accessSnapshot.data() ?? {};
  const candidates: ReadonlyArray<readonly [MemberRole, unknown]> = [
    ['elder', access.elderPasscodeHash],
    ['caretaker', access.caretakerPasscodeHash],
    ['family', access.familyPasscodeHash],
  ];
  const matches = await Promise.all(candidates.map(async ([, storedHash]) =>
    typeof storedHash === 'string' ? compare(input.passcode, storedHash) : false,
  ));
  const matchedIndex = matches.findIndex(Boolean);
  const matchedRole = matchedIndex < 0 ? null : candidates[matchedIndex][0];

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
      graceMinutes: Number(profileSnapshot.get('graceMinutes') ?? loadFunctionConfig().graceMinutes),
      joinedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(attemptsRef, { failures: 0, lockedUntil: 0, updatedAt: FieldValue.serverTimestamp() });
  });

  return { role: roleToAssign };
});
