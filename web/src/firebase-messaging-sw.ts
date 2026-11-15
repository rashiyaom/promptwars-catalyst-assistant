import { getApp, initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = (() => {
  try {
    return getApp();
  } catch {
    return initializeApp(firebaseConfig);
  }
})();
const messaging = getMessaging(app);

/** Show a concise system notification for a background FCM reminder. */
onBackgroundMessage(messaging, (payload) => {
  const title = payload.notification?.title ?? 'Sanjeevani care reminder';
  const body = payload.notification?.body ?? 'Open Sanjeevani to review a care-circle update.';
  const worker = self as unknown as {
    registration: { showNotification(title: string, options: { body: string; icon: string }): Promise<void> };
  };
  void worker.registration.showNotification(title, { body, icon: '/icon.svg' });
});
