/**
 * Fails the whole test run immediately if FIRESTORE_EMULATOR_HOST is not set — mirrors
 * scripts/question-bank/jest.globalSetup.js's guard so these tests can never fall through
 * to a real Firestore project.
 */
module.exports = async function globalSetup() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is not set — refusing to run functions/ tests against real ' +
        'Firestore. Run "npm run test:functions" from the repo root (which starts the emulator ' +
        'and sets this for you), or start the emulator yourself and set FIRESTORE_EMULATOR_HOST ' +
        '(e.g. "localhost:8180") before invoking jest directly.'
    );
  }
};
