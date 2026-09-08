import * as fs from 'fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

// ph-0-us-6: verifies the users/{uid} security rule enforces `request.auth.uid == uid`,
// per this story's acceptance criteria — run against the Firestore emulator, never a real
// project. See package.json's `test:rules` script for how this gets the emulator running.
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'dmv-app-rules-test',
    firestore: {
      host: 'localhost',
      port: 8180,
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

test('a signed-in device can read/write its own users/{uid} document', async () => {
  const alice = testEnv.authenticatedContext('alice-uid').firestore();

  await assertSucceeds(setDoc(doc(alice, 'users/alice-uid'), { createdAt: new Date() }));
});

test("a signed-in device cannot write another device's users/{uid} document", async () => {
  const alice = testEnv.authenticatedContext('alice-uid').firestore();

  await assertFails(setDoc(doc(alice, 'users/bob-uid'), { createdAt: new Date() }));
});

test("a signed-in device cannot read another device's users/{uid} document", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/bob-uid'), { createdAt: new Date() });
  });

  const alice = testEnv.authenticatedContext('alice-uid').firestore();
  await assertFails(getDoc(doc(alice, 'users/bob-uid')));
});

test('a device that has not signed in anonymously is rejected outright', async () => {
  const anon = testEnv.unauthenticatedContext().firestore();

  await assertFails(setDoc(doc(anon, 'users/alice-uid'), { createdAt: new Date() }));
});
