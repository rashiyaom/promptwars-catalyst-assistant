import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from 'firebase/messaging';
import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { getFirebaseClients } from './firebase.js';

/** Request browser permission and save the FCM token in a member-private path. */
export async function enablePushNotifications(profileId: string, memberId: string): Promise<boolean> {
  const clients = getFirebaseClients();
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!clients || !vapidKey || typeof window === 'undefined' || !(await isSupported())) return false;
  if (clients.auth.currentUser?.uid !== memberId) throw new Error('Sign in as this care-circle member first.');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { type: 'module' });
  const token = await getToken(getMessaging(clients.app), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return false;

  const tokenCollection = collection(
    clients.db,
    'profiles', profileId,
    'members', memberId,
    'private', 'notifications', 'pushTokens',
  );
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenId = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  await setDoc(doc(tokenCollection, tokenId), { token, updatedAt: Timestamp.now() });
  return true;
}

/** Subscribe to notifications received while the app is in the foreground. */
export async function listenForForegroundNotifications(
  onNotification: (payload: MessagePayload) => void,
): Promise<() => void> {
  const clients = getFirebaseClients();
  if (!clients || !(await isSupported())) return () => undefined;
  return onMessage(getMessaging(clients.app), onNotification);
}
