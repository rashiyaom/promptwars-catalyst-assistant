import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '../../lib/firebase.js';

/** Sign in an existing care-circle member with their email and password. */
export async function signInMember(email: string, password: string): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Sign-in is unavailable in offline demo mode.');
  await signInWithEmailAndPassword(clients.auth, email.trim(), password);
  // CareProvider synchronizes the account once the verified session is ready.
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
  return onIdTokenChanged(clients.auth, callback);
}

/** Synchronize a verified account without assigning any profile role. */
export async function ensureCareAccount(): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) return;
  const user = clients.auth.currentUser;
  if (!user?.emailVerified) return;
  // The cached ID token may predate verification in another tab. Firestore checks
  // its email_verified claim, not User.emailVerified. Refresh before any reads.
  await user.getIdToken(true);
  await setDoc(doc(clients.db, 'users', user.uid), {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName ?? '',
  });
}

export async function resendVerification(): Promise<void> {
  const user = getFirebaseClients()?.auth.currentUser;
  if (!user) throw new Error('Sign in first.');
  await sendEmailVerification(user);
}

/** Refresh both user state and token claims after following the email link. */
export async function refreshVerification(): Promise<boolean> {
  const user = getFirebaseClients()?.auth.currentUser;
  if (!user) return false;
  await reload(user);
  await user.getIdToken(true);
  if (user.emailVerified) await ensureCareAccount();
  return user.emailVerified;
}
