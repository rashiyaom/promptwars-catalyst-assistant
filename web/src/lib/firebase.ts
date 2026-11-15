import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';

/** Firebase clients used by the Sanjeevani browser application. */
export interface FirebaseClients {
  readonly app: FirebaseApp;
  readonly appCheck: AppCheck | null;
  readonly auth: Auth;
  readonly db: Firestore;
  readonly functions: Functions;
  readonly ai: AI;
}

let clients: FirebaseClients | null | undefined;

/** Initialize Firebase once, while keeping the default local demo offline. */
export function getFirebaseClients(): FirebaseClients | null {
  if (clients !== undefined) return clients;

  const environment = import.meta.env;
  const mockMode = environment.VITE_MOCK_MODE?.toLowerCase() !== 'false';
  const config = {
    apiKey: environment.VITE_FIREBASE_API_KEY,
    authDomain: environment.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: environment.VITE_FIREBASE_PROJECT_ID,
    storageBucket: environment.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: environment.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: environment.VITE_FIREBASE_APP_ID,
  };
  const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

  if (mockMode) {
    clients = null;
    return clients;
  }
  if (!configured) {
    throw new Error('Set the VITE_FIREBASE_* values before enabling Firebase mode.');
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const localEmulators = environment.VITE_USE_FIREBASE_EMULATORS === 'true';
  const recaptchaSiteKey = environment.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  let appCheck: AppCheck | null = null;

  if (!localEmulators) {
    if (recaptchaSiteKey) {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else {
      console.warn('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is not configured. App Check is disabled for development.');
    }
  }

  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, 'us-central1');
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  if (localEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }

  clients = { app, appCheck, auth, db, functions, ai };
  return clients;
}
