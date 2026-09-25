import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { toCallableError } from './callableErrors';
import type { AnswerSubmission, AssembledTest, BaselineSection, ScoreTestResult } from './types';

// ph-3-us-4: the app's only way to call Cloud Functions. Each wrapper resolves with the typed
// response or rejects with a CallableError, so screens never see raw Firebase errors.
// Contracts: functions/README.md.

async function call<Req, Res>(name: string, data?: Req): Promise<Res> {
  try {
    const result = await httpsCallable<Req, Res>(getFunctions(getApp()), name)(data as Req);
    return result.data;
  } catch (error) {
    throw toCallableError(error);
  }
}

export function startOrResumeBaseline(): Promise<BaselineSection> {
  return call('startOrResumeBaseline');
}

export function scoreTest(input: {
  testId: string;
  answers: AnswerSubmission[];
}): Promise<ScoreTestResult> {
  return call('scoreTest', input);
}

/** Practice tests: wired to a screen in Slice 5. */
export function assembleTest(): Promise<AssembledTest> {
  return call('assembleTest');
}

/** Concept mini-quizzes: wired to a screen in Slice 4b. */
export function assembleMiniQuiz(input: {
  chunkId: string;
  count?: number;
  excludeIds?: string[];
}): Promise<AssembledTest> {
  return call('assembleMiniQuiz', input);
}
