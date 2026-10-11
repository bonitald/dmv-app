import * as fs from 'fs';
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
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

test('a signed-in device can create and read its own users/{uid} document', async () => {
  const alice = testEnv.authenticatedContext('alice-uid').firestore();

  await assertSucceeds(setDoc(doc(alice, 'users/alice-uid'), { createdAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(alice, 'users/alice-uid')));
});

// ph-9-us-2: the profile doc may be created with only createdAt (a server timestamp), and
// afterwards the owner may change only `onboarding` and `testDate`, with valid values.
describe('users/{uid} profile fields (ph-9-us-2)', () => {
  const profile = () => doc(testEnv.authenticatedContext('alice-uid').firestore(), 'users/alice-uid');

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/alice-uid'), { createdAt: new Date() });
    });
  });

  test('create with a client-chosen createdAt is denied', async () => {
    const bob = testEnv.authenticatedContext('bob-uid').firestore();
    await assertFails(setDoc(doc(bob, 'users/bob-uid'), { createdAt: new Date(2020, 0, 1) }));
  });

  test('create with any field besides createdAt is denied', async () => {
    const bob = testEnv.authenticatedContext('bob-uid').firestore();
    await assertFails(
      setDoc(doc(bob, 'users/bob-uid'), { createdAt: serverTimestamp(), testDate: '2026-10-01' })
    );
  });

  test.each(['baseline', 'learn'])('setting onboarding with choice %s succeeds', async (choice) => {
    await assertSucceeds(
      updateDoc(profile(), { onboarding: { choice, completedAt: serverTimestamp() } })
    );
  });

  test('re-running onboarding overwrites it', async () => {
    await assertSucceeds(
      updateDoc(profile(), { onboarding: { choice: 'learn', completedAt: serverTimestamp() } })
    );
    await assertSucceeds(
      updateDoc(profile(), { onboarding: { choice: 'baseline', completedAt: serverTimestamp() } })
    );
  });

  test('setting onboarding and testDate in one write succeeds', async () => {
    await assertSucceeds(
      updateDoc(profile(), {
        onboarding: { choice: 'baseline', completedAt: serverTimestamp() },
        testDate: '2026-10-22',
      })
    );
  });

  test('setting testDate before onboarding, then clearing it with null, succeeds', async () => {
    await assertSucceeds(updateDoc(profile(), { testDate: '2026-10-22' }));
    await assertSucceeds(updateDoc(profile(), { testDate: null }));
  });

  test('an unknown onboarding choice is denied', async () => {
    await assertFails(
      updateDoc(profile(), { onboarding: { choice: 'other', completedAt: serverTimestamp() } })
    );
  });

  test('a client-chosen completedAt is denied', async () => {
    await assertFails(
      updateDoc(profile(), { onboarding: { choice: 'learn', completedAt: new Date() } })
    );
  });

  test('extra keys inside onboarding are denied', async () => {
    await assertFails(
      updateDoc(profile(), {
        onboarding: { choice: 'learn', completedAt: serverTimestamp(), age: 15 },
      })
    );
  });

  test.each(['2026-13-40', 'next week', '2026-1-5', ''])('testDate %p is denied', async (value) => {
    await assertFails(updateDoc(profile(), { testDate: value }));
  });

  test('a non-string testDate is denied', async () => {
    await assertFails(updateDoc(profile(), { testDate: new Date() }));
  });

  test('removing the onboarding field is denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users/alice-uid'), {
        onboarding: { choice: 'learn', completedAt: new Date() },
      });
    });
    await assertFails(updateDoc(profile(), { onboarding: deleteField() }));
  });

  test('changing createdAt is denied', async () => {
    await assertFails(updateDoc(profile(), { createdAt: serverTimestamp() }));
  });

  test('writing any other field is denied', async () => {
    await assertFails(updateDoc(profile(), { name: 'Alex' }));
  });

  test('deleting the profile doc is denied', async () => {
    await assertFails(deleteDoc(profile()));
  });

  test("updating another user's profile is denied", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/bob-uid'), { createdAt: new Date() });
    });
    const alice = testEnv.authenticatedContext('alice-uid').firestore();
    await assertFails(updateDoc(doc(alice, 'users/bob-uid'), { testDate: '2026-10-22' }));
  });
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

// ph-2-us-11: Concept Progress. The client may set only `status` (one of three values) and a
// server `statusUpdatedAt`; the score fields belong to scoreTest. Owner-only, never deleted.
describe('users/{uid}/conceptProgress (ph-2-us-11)', () => {
  const path = 'users/alice-uid/conceptProgress/row';
  const alice = () => testEnv.authenticatedContext('alice-uid').firestore();
  const seed = (docPath: string, data: Record<string, unknown>) =>
    testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), docPath), data);
    });
  const scored = { latestMiniQuizScore: 0.6, latestMiniQuizAt: new Date(), latestTestId: 't1' };

  test('the owner can read their own doc', async () => {
    await seed(path, { status: 'reviewed' });
    await assertSucceeds(getDoc(doc(alice(), path)));
  });

  test("reading another user's doc is denied", async () => {
    await seed('users/bob-uid/conceptProgress/row', { status: 'reviewed' });
    await assertFails(getDoc(doc(alice(), 'users/bob-uid/conceptProgress/row')));
  });

  test.each(['in-progress', 'reviewed', 'needs-revisit'])(
    'creating with status %s and a server statusUpdatedAt succeeds',
    async (status) => {
      await assertSucceeds(
        setDoc(doc(alice(), path), { status, statusUpdatedAt: serverTimestamp() })
      );
    }
  );

  test.each(['not-started', 'done', ''])('status "%s" is denied', async (status) => {
    await assertFails(setDoc(doc(alice(), path), { status, statusUpdatedAt: serverTimestamp() }));
  });

  test('a client-chosen statusUpdatedAt is denied', async () => {
    await assertFails(setDoc(doc(alice(), path), { status: 'reviewed', statusUpdatedAt: new Date() }));
  });

  test('creating without statusUpdatedAt is denied', async () => {
    await assertFails(setDoc(doc(alice(), path), { status: 'reviewed' }));
  });

  test('creating with a score is denied', async () => {
    await assertFails(
      setDoc(doc(alice(), path), {
        status: 'reviewed',
        statusUpdatedAt: serverTimestamp(),
        latestMiniQuizScore: 1,
      })
    );
  });

  test('creating with an unknown key is denied', async () => {
    await assertFails(
      setDoc(doc(alice(), path), { status: 'reviewed', statusUpdatedAt: serverTimestamp(), note: 'x' })
    );
  });

  test('the owner can set status on a doc scoreTest already wrote', async () => {
    await seed(path, scored);
    await assertSucceeds(
      setDoc(doc(alice(), path), { status: 'reviewed', statusUpdatedAt: serverTimestamp() }, { merge: true })
    );
  });

  test('changing a score field on update is denied', async () => {
    await seed(path, { ...scored, status: 'in-progress', statusUpdatedAt: new Date() });
    await assertFails(
      updateDoc(doc(alice(), path), {
        status: 'reviewed',
        statusUpdatedAt: serverTimestamp(),
        latestMiniQuizScore: 1,
      })
    );
  });

  test('removing a score field is denied', async () => {
    await seed(path, { ...scored, status: 'in-progress', statusUpdatedAt: new Date() });
    await assertFails(updateDoc(doc(alice(), path), { latestTestId: deleteField() }));
  });

  test('changing status to not-started on update is denied', async () => {
    await seed(path, { status: 'reviewed', statusUpdatedAt: new Date() });
    await assertFails(
      updateDoc(doc(alice(), path), { status: 'not-started', statusUpdatedAt: serverTimestamp() })
    );
  });

  test.each(['latestMiniQuizCorrect', 'latestMiniQuizTotal', 'miniQuizPassCount', 'miniQuizFailCount'])(
    'a client write of %s is denied',
    async (field) => {
      await assertFails(
        setDoc(doc(alice(), path), {
          status: 'reviewed',
          statusUpdatedAt: serverTimestamp(),
          [field]: 10,
        })
      );
    }
  );

  test('deleting is denied', async () => {
    await seed(path, { status: 'reviewed', statusUpdatedAt: new Date() });
    await assertFails(deleteDoc(doc(alice(), path)));
  });

  test("writing another user's doc is denied", async () => {
    await assertFails(
      setDoc(doc(alice(), 'users/bob-uid/conceptProgress/row'), {
        status: 'reviewed',
        statusUpdatedAt: serverTimestamp(),
      })
    );
  });

  test('an unauthenticated device can neither read nor write', async () => {
    await seed(path, { status: 'reviewed' });
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, path)));
    await assertFails(setDoc(doc(anon, path), { status: 'reviewed', statusUpdatedAt: serverTimestamp() }));
  });
});
