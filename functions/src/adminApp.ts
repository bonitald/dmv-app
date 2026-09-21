import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const DEFAULT_PROJECT_ID = 'dmv-app-dev';

/**
 * In the deployed Cloud Functions runtime, GCLOUD_PROJECT and default credentials are supplied
 * automatically. Outside that runtime (e.g. these Jest tests, which run as plain Node against
 * the Firestore emulator via FIRESTORE_EMULATOR_HOST), initializeApp() needs an explicit
 * projectId or it hangs trying to resolve one — mirrors scripts/question-bank/lib/adminApp.ts.
 */
export function getDb(): Firestore {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID;

  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  return getFirestore();
}
