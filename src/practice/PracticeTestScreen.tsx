import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ActivityIndicator, StyleSheet, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { assembleTest, scoreTest } from '../api/callables';
import { toCallableError } from '../api/callableErrors';
import type { PerQuestionResult, QuizQuestion, TimingSubmission } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { NoConnection } from '../components/NoConnection';
import { openConcept } from '../navigation/openConcept';
import type { RootStackScreenProps } from '../navigation/types';
import { useIsOnline } from '../network/useIsOnline';
import { toAnswerList, type Answers } from '../quiz/answers';
import { QuizRunner, type SubmitState } from '../quiz/QuizRunner';
import { PRACTICE_CACHE_WARNING, endSession, getActiveSession, saveAnswers, startSession } from '../quiz/quizSession';
import { useTestAttempt } from '../review/useTestAttempt';
import { recordTestResults } from '../study/cardPerformance';
import { colors } from '../theme/tokens';
import { getPracticeMode } from '../profile/localFlags';
import { useTopics } from '../topics/useTopics';
import { fromPracticeAttempt, fromPracticeScore, type PracticeOutcome } from './practiceData';
import { PracticeResults } from './PracticeResults';
import { startPracticeTest } from './startPracticeTest';
import { TestTimer } from './TestTimer';
import { TIMED_TEST_LIMIT_SEC, timedLimitSec, timingPayload, type SessionTiming } from './timing';

// ph-3-us-4 / ph-3-us-1: a 25-question practice test on the shared runner. The questions and
// answers are kept on the phone (quizSession) until graded, so leaving or a force-quit resumes.
// Offline at submit, the answers are held and sent on reconnect.
//
// ph-3-us-9: a timed test carries a `timing` (start time + limit) saved with the session, so the
// clock keeps running while the app is closed. At zero the screen locks and submits the latest
// answers by itself. The elapsed time is captured once, at the first submit attempt, and reused.

const TIME_UP_NOTICE = "Time's up. Submitting your answers…";
export const TIME_UP_RETRY_NOTICE = "Time's up. Your answers are saved — tap Try again to send them.";
const TIME_UP_OFFLINE_NOTICE = "Time's up. Your answers are saved and will be sent when you're back online.";

type Phase =
  | { kind: 'loading' }
  | { kind: 'running'; testId: string; questions: QuizQuestion[]; initialAnswers: Answers; notice?: string; timing?: SessionTiming }
  | { kind: 'results'; outcome: PracticeOutcome }
  /** scoreTest said it was already graded: read the saved attempt instead. */
  | { kind: 'recovering'; testId: string }
  | { kind: 'offline' }
  /** scoreTest permanently rejected this test (gone or not ours): it can't be submitted. */
  | { kind: 'rejected' }
  | { kind: 'error' };

export function PracticeTestScreen({ navigation, route }: RootStackScreenProps<'PracticeTest'>) {
  const resume = route.params?.resume === true;
  const timed = route.params?.timed === true;
  const { uid } = useAuth();
  const isOnline = useIsOnline();
  const topics = useTopics();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const submittingRef = useRef(false);
  const heldAnswersRef = useRef<Answers | null>(null);
  // True once the connection has been seen down while answers are held, so the resend waits for
  // a real reconnect (a held send after an offline-looking failure must not retry in a loop).
  const offlineSeenRef = useRef(false);
  const [timeUp, setTimeUp] = useState(false);
  // The latest answers, so the auto-submit at zero doesn't depend on a re-read of storage.
  const answersRef = useRef<Answers>({});
  // The timing for scoreTest, captured at the first submit attempt (null = not yet) and reused
  // on retries and the reconnect resend.
  const pendingTimingRef = useRef<TimingSubmission | undefined | null>(null);
  // Set once the test is graded or rejected, so a stale confirm dialog can't submit it again.
  const doneRef = useRef(false);
  // Set when the screen unmounts, so an assembleTest still in flight can't save a test nobody saw.
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (!uid) return;
    setPhase({ kind: 'loading' });
    setSubmitState('idle');
    setTimeUp(false);
    pendingTimingRef.current = null;
    doneRef.current = false;
    try {
      if (resume) {
        const active = await getActiveSession(uid, 'practice');
        if (active) {
          answersRef.current = active.answers;
          setPhase({
            kind: 'running',
            testId: active.testId,
            questions: active.questions,
            initialAnswers: active.answers,
            timing: active.timing,
          });
          return;
        }
      }
      // A resume with nothing saved starts a fresh test, in the mode the Practice tab has selected.
      const startTimed = resume ? (await getPracticeMode(uid)) === 'timed' : timed;
      const { testId, questions } = await assembleTest();
      if (cancelledRef.current) return;
      let notice: string | undefined;
      const timing: SessionTiming = {
        mode: startTimed ? 'timed' : 'untimed',
        timeLimitSec: startTimed ? timedLimitSec() : undefined,
        startedAt: Date.now(),
      };
      try {
        await startSession(uid, testId, 'practice', questions, timing);
      } catch (error) {
        console.warn('[practice] caching the test failed', error);
        notice = PRACTICE_CACHE_WARNING;
      }
      answersRef.current = {};
      setPhase({ kind: 'running', testId, questions, initialAnswers: {}, notice, timing });
    } catch (raw) {
      if (cancelledRef.current) return;
      const error = toCallableError(raw);
      if (error.kind !== 'offline') console.warn('[practice] load failed', error);
      setPhase({ kind: error.kind === 'offline' ? 'offline' : 'error' });
    }
  }, [uid, resume, timed]);

  useEffect(() => {
    cancelledRef.current = false;
    void load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  /** The session is over: drop held answers and the captured timing, and refuse further submits. */
  const finish = useCallback(() => {
    heldAnswersRef.current = null;
    pendingTimingRef.current = null;
    doneRef.current = true;
  }, []);

  const submit = useCallback(
    async (answers: Answers, timedOut = false) => {
      if (phase.kind !== 'running' || !uid || doneRef.current) return;
      // First attempt fixes the elapsed time; later attempts (retry, reconnect) reuse it. Running
      // out of time overrides it: a timed-out test is recorded as exactly the limit.
      if (pendingTimingRef.current === null || timedOut) {
        pendingTimingRef.current = timingPayload(phase.timing, Date.now(), timedOut);
      }
      if (submittingRef.current) return;
      if (!isOnline) {
        heldAnswersRef.current = answers;
        setSubmitState('waiting-for-connection');
        return;
      }
      submittingRef.current = true;
      setSubmitState('submitting');
      try {
        const timing = pendingTimingRef.current;
        const result = await scoreTest({
          testId: phase.testId,
          answers: toAnswerList(phase.questions, answers),
          ...(timing ? { timing } : {}),
        });
        finish();
        await endSession(uid, 'practice', phase.testId);
        setPhase({ kind: 'results', outcome: fromPracticeScore(result) });
        // Slice 5b-2: graded now, so it feeds flashcard order (once; see recordTestResults).
        void recordTestResults(uid, result.testId, result.perQuestion);
      } catch (raw) {
        const error = toCallableError(raw);
        if (error.kind === 'already-exists') {
          // Graded already (an earlier response was lost): show what was saved.
          finish();
          await endSession(uid, 'practice', phase.testId);
          setPhase({ kind: 'recovering', testId: phase.testId });
        } else if (error.kind === 'not-found' || error.kind === 'permission-denied') {
          // Retrying can never work: drop the saved test and send the teen back to start fresh.
          console.warn('[practice] submit rejected', error);
          finish();
          await endSession(uid, 'practice', phase.testId);
          setPhase({ kind: 'rejected' });
        } else if (error.kind === 'offline') {
          // The connection dropped mid-send before the app noticed. NetInfo may keep saying
          // online (captive portal, dead upstream), so show "Try again" rather than a dead-end
          // waiting state, and keep the answers to resend on a real offline-to-online change.
          heldAnswersRef.current = answers;
          offlineSeenRef.current = false;
          setSubmitState('error');
        } else {
          console.warn('[practice] submit failed', error);
          setSubmitState('error');
        }
      } finally {
        submittingRef.current = false;
      }
    },
    [phase, uid, isOnline, finish]
  );

  useEffect(() => {
    if (!isOnline) {
      offlineSeenRef.current = true;
    } else if (
      (submitState === 'waiting-for-connection' || submitState === 'error') &&
      heldAnswersRef.current &&
      offlineSeenRef.current
    ) {
      const answers = heldAnswersRef.current;
      heldAnswersRef.current = null;
      offlineSeenRef.current = false;
      void submit(answers);
    }
  }, [isOnline, submitState, submit]);

  // Leaving keeps the session on the phone, so it resumes from the Practice tab.
  const isTimed = phase.kind === 'running' && phase.timing?.mode === 'timed';
  usePreventRemove(phase.kind === 'running' && submitState !== 'submitting' && !timeUp, ({ data }) => {
    const message = isTimed
      ? "Your answers are saved. The timer keeps going while you're away. You can resume it from the Practice tab."
      : 'Your answers are saved. You can resume it from the Practice tab.';
    Alert.alert('Leave the test?', message, [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const results = (outcome: PracticeOutcome) =>
    topics.status === 'loading' ? (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading your results" />
      </View>
    ) : (
    <PracticeResults
      outcome={outcome}
      topics={topics.status === 'ready' ? topics.topics : []}
      onOpenTopic={(chunkId) => openConcept(navigation, chunkId)}
      onReview={() => navigation.navigate('Review', { testId: outcome.testId })}
      onTakeAnother={() => {
        if (uid) void startPracticeTest(navigation, uid, 'replace');
      }}
      onBack={() => navigation.popTo('Main', { screen: 'PracticeTests' })}
      onOpenMissed={() => navigation.navigate('MissedQuestions')}
    />
    );

  switch (phase.kind) {
    case 'loading':
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading the test" />
        </View>
      );
    case 'running': {
      const timing = phase.timing;
      const timeUpNotice = () =>
        !isOnline ? TIME_UP_OFFLINE_NOTICE : submitState === 'error' ? TIME_UP_RETRY_NOTICE : TIME_UP_NOTICE;
      return (
        <QuizRunner
          key={phase.testId}
          questions={phase.questions}
          title="Practice test"
          initialAnswers={phase.initialAnswers}
          onAnswersChange={(answers) => {
            answersRef.current = answers;
            if (uid) void saveAnswers(uid, 'practice', phase.testId, answers);
          }}
          onSubmit={(answers) => void submit(answers)}
          submitState={submitState}
          isOnline={isOnline}
          notice={timeUp ? timeUpNotice() : phase.notice}
          locked={timeUp}
          headerAccessory={
            timing?.mode === 'timed' ? (
              <TestTimer
                startedAt={timing.startedAt}
                limitSec={timing.timeLimitSec ?? TIMED_TEST_LIMIT_SEC}
                onExpire={() => {
                  setTimeUp(true);
                  void submit(answersRef.current, true);
                }}
              />
            ) : undefined
          }
        />
      );
    }
    case 'recovering':
      return <Recovered uid={uid} testId={phase.testId} render={results} />;
    case 'results':
      return results(phase.outcome);
    case 'offline':
      return <NoConnection message="The test needs a connection to load. Check your connection and try again." onRetry={() => void load()} />;
    case 'rejected':
      return (
        <NoConnection
          title="Something went wrong"
          message="This test can't be submitted any more. Start a new one from the Practice tab."
          actionLabel="Back to Practice"
          onRetry={() => navigation.popTo('Main', { screen: 'PracticeTests' })}
        />
      );
    case 'error':
      return <NoConnection title="Something went wrong" message="We couldn't load the test. Try again in a moment." onRetry={() => void load()} />;
  }
}

/** Reads the saved attempt after `already-exists` and shows its results. */
function Recovered({
  uid,
  testId,
  render,
}: {
  uid: string | null;
  testId: string;
  render: (o: PracticeOutcome) => React.ReactElement;
}) {
  const attempt = useTestAttempt(testId);
  const outcome = attempt.status === 'ready' ? fromPracticeAttempt(testId, attempt.data) : null;
  // Graded just now (the response was lost), so it still feeds flashcard order, once.
  const perQuestion = attempt.status === 'ready' ? attempt.data?.perQuestion : undefined;
  const recordedRef = useRef(false);
  useEffect(() => {
    if (recordedRef.current || !uid || !outcome || !Array.isArray(perQuestion)) return;
    recordedRef.current = true;
    void recordTestResults(uid, testId, perQuestion as PerQuestionResult[]);
  }, [uid, testId, outcome, perQuestion]);
  if (outcome) return render(outcome);
  if (attempt.status === 'error' || attempt.status === 'ready') {
    return (
      <NoConnection
        title={attempt.status === 'error' && attempt.offline ? 'No connection' : 'Something went wrong'}
        message="Your test was graded, but its results couldn't load. Try again."
        onRetry={attempt.retry}
      />
    );
  }
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} accessibilityLabel="Loading your results" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
