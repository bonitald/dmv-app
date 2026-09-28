import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const DEFAULT_PROJECT_ID = 'dmv-app-dev';

/**
 * In the deployed Cloud Functions runtime, GCLOUD_PROJECT and default credentials are supplied
 * automatically. Outside that runtime (e.g. these Jest tests, which run as plain Node against
 * the Firestore emulator via FIRESTORE_EMULATOR_HOST), initializeApp() needs an explicit
 * projectId or it hangs trying to resolve one — mirrors scripts/question-bank/lib/adminApp.ts.
 *
 * Checks for the *default* app, not any app: when a signed-in call reaches a cold instance,
 * firebase-functions verifies the ID token first and, finding no default app, registers its own
 * named `__FIREBASE_FUNCTIONS_SDK__` app. getFirestore() only uses the default one.
 */
export function getDb(): Firestore {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID;

  if (!getApps().some((app) => app.name === '[DEFAULT]')) {
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  return getFirestore();
}
