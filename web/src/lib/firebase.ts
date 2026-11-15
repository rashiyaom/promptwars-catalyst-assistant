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

function getFirebaseConfig(): {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly storageBucket?: string;
  readonly messagingSenderId?: string;
  readonly appId: string;
} {
  const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY ?? '');
  const authDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '');
  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '');
  const appId = String(import.meta.env.VITE_FIREBASE_APP_ID ?? '');

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error('Set the VITE_FIREBASE_* values before enabling Firebase mode.');
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ? String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) : undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) : undefined,
  };
}

function initAppCheck(app: FirebaseApp, siteKey: string | undefined): AppCheck | null {
  if (siteKey) {
    return initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  console.warn('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is not configured. App Check is disabled for development.');
  return null;
}

function attachEmulators(auth: Auth, db: Firestore, functions: Functions): void {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

/** Initialize Firebase once, while keeping the default local demo offline. */
export function getFirebaseClients(): FirebaseClients | null {
  if (clients !== undefined) return clients;

  const mockMode = import.meta.env.VITE_MOCK_MODE?.toLowerCase() !== 'false';
  if (mockMode) {
    clients = null;
    return clients;
  }

  const config = getFirebaseConfig();
  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const localEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
  const appCheck = localEmulators ? null : initAppCheck(app, import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY);

  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, 'us-central1');
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  if (localEmulators) {
    attachEmulators(auth, db, functions);
  }

  clients = { app, appCheck, auth, db, functions, ai };
  return clients;
}
