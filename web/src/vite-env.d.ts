/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOCK_MODE?: string;
  readonly VITE_USE_FIREBASE_EMULATORS?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_VAPID_KEY?: string;
  readonly VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
