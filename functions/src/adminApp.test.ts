import { applicationDefault, getApp, initializeApp } from 'firebase-admin/app';
import { getDb } from './adminApp';

describe('getDb', () => {
  // firebase-functions verifies a signed-in caller's ID token before the handler runs, and if no
  // default app exists yet it creates its own named app for that. A cold instance whose first
  // call is signed in reaches getDb with that named app already registered.
  test('initializes the default app even when firebase-functions already created a named one', () => {
    initializeApp(
      { credential: applicationDefault(), projectId: 'dmv-app-dev' },
      '__FIREBASE_FUNCTIONS_SDK__'
    );

    expect(() => getDb()).not.toThrow();
    expect(getApp().name).toBe('[DEFAULT]');
  });
});
