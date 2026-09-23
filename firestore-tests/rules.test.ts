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

// ph-1-us-1: locks in the deny-all-by-default guarantee for the question bank, so a future
// rule change can't silently reopen direct client access to it.
test('a signed-in device cannot read the questions collection', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'questions/q1'), { text: 'What does a red light mean?' });
  });

  const alice = testEnv.authenticatedContext('alice-uid').firestore();
  await assertFails(getDoc(doc(alice, 'questions/q1')));
});

test('a signed-in device cannot read the ingestionRuns collection', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'ingestionRuns/run1'), { status: 'complete' });
  });

  const alice = testEnv.authenticatedContext('alice-uid').firestore();
  await assertFails(getDoc(doc(alice, 'ingestionRuns/run1')));
});

test('a signed-in device cannot write its own testAssignments doc', async () => {
  const alice = testEnv.authenticatedContext('alice-uid').firestore();

  await assertFails(
    setDoc(doc(alice, 'users/alice-uid/testAssignments/t1'), { type: 'practice' })
  );
});

test('a signed-in device can read its own testAssignments doc', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/alice-uid/testAssignments/t1'), {
      type: 'practice',
    });
  });

  const alice = testEnv.authenticatedContext('alice-uid').firestore();
  await assertSucceeds(getDoc(doc(alice, 'users/alice-uid/testAssignments/t1')));
});

test("a signed-in device cannot read another device's testAssignments doc", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/bob-uid/testAssignments/t1'), {
      type: 'practice',
    });
  });

  const alice = testEnv.authenticatedContext('alice-uid').firestore();
  await assertFails(getDoc(doc(alice, 'users/bob-uid/testAssignments/t1')));
});

test('a signed-in device cannot write its own testAttempts doc', async () => {
  const alice = testEnv.authenticatedContext('alice-uid').firestore();

  await assertFails(setDoc(doc(alice, 'users/alice-uid/testAttempts/t1'), { score: 1 }));
});

test('a signed-in device cannot write its own baseline progress doc', async () => {
  const alice = testEnv.authenticatedContext('alice-uid').firestore();

  await assertFails(
    setDoc(doc(alice, 'users/alice-uid/baseline/progress'), { currentSection: 1 })
  );
});

test('a signed-in device can read its own baseline progress doc', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/alice-uid/baseline/progress'), {
      currentSection: 1,
    });
  });

  const alice = testEnv.authenticatedContext('alice-uid').firestore();
  await assertSucceeds(getDoc(doc(alice, 'users/alice-uid/baseline/progress')));
});

test('a signed-in device can read topics', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'topics/right-of-way'), { title: 'Right of Way' });
  });

  const alice = testEnv.authenticatedContext('alice-uid').firestore();
  await assertSucceeds(getDoc(doc(alice, 'topics/right-of-way')));
});

test('a signed-in device cannot write topics', async () => {
  const alice = testEnv.authenticatedContext('alice-uid').firestore();

  await assertFails(setDoc(doc(alice, 'topics/right-of-way'), { title: 'Hacked' }));
});

test('an unauthenticated device cannot read topics', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'topics/right-of-way'), { title: 'Right of Way' });
  });

  const anon = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, 'topics/right-of-way')));
});
