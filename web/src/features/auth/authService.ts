import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseClients } from '../../lib/firebase.js';

/** Sign in an existing care-circle member with their email and password. */
export async function signInMember(email: string, password: string): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Sign-in is unavailable in offline demo mode.');
  const credential = await signInWithEmailAndPassword(clients.auth, email.trim(), password);
  if (!credential.user.emailVerified) {
    await signOut(clients.auth);
    throw new Error('Verify your email address before signing in. Check your inbox for the verification link.');
  }
}

/** Create a Firebase Authentication account for a new care-circle member. */
export async function registerMember(
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Account creation is unavailable in offline demo mode.');
  const credential = await createUserWithEmailAndPassword(clients.auth, email.trim(), password);
  await updateProfile(credential.user, { displayName: displayName.trim() });
  await sendEmailVerification(credential.user);
}

/** Send a password reset email through Firebase Authentication. */
export async function sendMemberPasswordReset(email: string): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Password reset is unavailable in offline demo mode.');
  await sendPasswordResetEmail(clients.auth, email.trim());
}

/** End the current member session. */
export async function signOutMember(): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) return;
  await signOut(clients.auth);
}

/** Subscribe to authentication state changes. */
export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  const clients = getFirebaseClients();
  if (!clients) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(clients.auth, callback);
}

/** Create an elder-owned profile and store role codes as server-side hashes. */
export async function createCareProfile(input: {
  readonly elderName: string;
  readonly displayName: string;
  readonly timezone: string;
  readonly elderPasscode: string;
  readonly caretakerPasscode: string;
  readonly familyPasscode: string;
}): Promise<{ readonly profileId: string }> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Profile creation is unavailable in offline demo mode.');
  const callable = httpsCallable<typeof input, { profileId: string }>(clients.functions, 'createCareProfile');
  const result = await callable(input);
  return result.data;
}

/** Join an existing profile using a role passcode verified by a callable function. */
export async function joinCareProfile(input: {
  readonly profileId: string;
  readonly passcode: string;
  readonly displayName: string;
}): Promise<{ readonly role: 'elder' | 'caretaker' | 'family' }> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Joining a profile is unavailable in offline demo mode.');
  const callable = httpsCallable<typeof input, { role: 'elder' | 'caretaker' | 'family' }>(clients.functions, 'joinCareProfile');
  const result = await callable(input);
  return result.data;
}
