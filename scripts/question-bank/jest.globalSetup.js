/**
 * Fails the whole test run immediately if FIRESTORE_EMULATOR_HOST is not set.
 *
 * Without this guard, `npx jest --config jest.scripts.config.js` run directly (bypassing
 * `npm run test:question-bank`, which wraps the suite in `firebase emulators:exec`) would fall
 * through `lib/adminApp.ts`'s ADC fallback and write test documents straight into the real
 * `dmv-app-dev` Firestore project. This is a plain .js file (not .ts) because Jest's
 * `globalSetup` runs before ts-jest's transform is available.
 */
module.exports = async function globalSetup() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is not set — refusing to run scripts/question-bank tests against ' +
        'real Firestore. Run "npm run test:question-bank" (which starts the emulator and sets ' +
        'this for you), or start the emulator yourself and set FIRESTORE_EMULATOR_HOST ' +
        '(e.g. "localhost:8080") before invoking jest directly.'
    );
  }
};
