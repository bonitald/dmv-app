import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ActivityIndicator, StyleSheet, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { assembleTest, scoreTest } from '../api/callables';
import { toCallableError } from '../api/callableErrors';
import type { QuizQuestion } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { NoConnection } from '../components/NoConnection';
import { openConcept } from '../navigation/openConcept';
import type { RootStackScreenProps } from '../navigation/types';
import { useIsOnline } from '../network/useIsOnline';
import { toAnswerList, type Answers } from '../quiz/answers';
import { QuizRunner, type SubmitState } from '../quiz/QuizRunner';
import { PRACTICE_CACHE_WARNING, endSession, getActiveSession, saveAnswers, startSession } from '../quiz/quizSession';
import { useTestAttempt } from '../review/useTestAttempt';
import { colors } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { fromPracticeAttempt, fromPracticeScore, type PracticeOutcome } from './practiceData';
import { PracticeResults } from './PracticeResults';
import { startPracticeTest } from './startPracticeTest';

// ph-3-us-4 / ph-3-us-1: a 25-question practice test on the shared runner. The questions and
// answers are kept on the phone (quizSession) until graded, so leaving or a force-quit resumes.
// Offline at submit, the answers are held and sent on reconnect.

type Phase =
  | { kind: 'loading' }
  | { kind: 'running'; testId: string; questions: QuizQuestion[]; initialAnswers: Answers; notice?: string }
  | { kind: 'results'; outcome: PracticeOutcome }
  /** scoreTest said it was already graded: read the saved attempt instead. */
  | { kind: 'recovering'; testId: string }
  | { kind: 'offline' }
  /** scoreTest permanently rejected this test (gone or not ours): it can't be submitted. */
  | { kind: 'rejected' }
  | { kind: 'error' };

export function PracticeTestScreen({ navigation, route }: RootStackScreenProps<'PracticeTest'>) {
  const resume = route.params?.resume === true;
  const { uid } = useAuth();
  const isOnline = useIsOnline();
  const topics = useTopics();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const submittingRef = useRef(false);
  const heldAnswersRef = useRef<Answers | null>(null);
  // Set when the screen unmounts, so an assembleTest still in flight can't save a test nobody saw.
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (!uid) return;
    setPhase({ kind: 'loading' });
    setSubmitState('idle');
    try {
      if (resume) {
        const active = await getActiveSession(uid, 'practice');
        if (active) {
          setPhase({ kind: 'running', testId: active.testId, questions: active.questions, initialAnswers: active.answers });
          return;
        }
      }
      const { testId, questions } = await assembleTest();
      if (cancelledRef.current) return;
      let notice: string | undefined;
      try {
        await startSession(uid, testId, 'practice', questions);
      } catch (error) {
        console.warn('[practice] caching the test failed', error);
        notice = PRACTICE_CACHE_WARNING;
      }
      setPhase({ kind: 'running', testId, questions, initialAnswers: {}, notice });
    } catch (raw) {
      if (cancelledRef.current) return;
      const error = toCallableError(raw);
      if (error.kind !== 'offline') console.warn('[practice] load failed', error);
      setPhase({ kind: error.kind === 'offline' ? 'offline' : 'error' });
    }
  }, [uid, resume]);

  useEffect(() => {
    cancelledRef.current = false;
    void load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  const submit = useCallback(
    async (answers: Answers) => {
      if (phase.kind !== 'running' || !uid || submittingRef.current) return;
      if (!isOnline) {
        heldAnswersRef.current = answers;
        setSubmitState('waiting-for-connection');
        return;
      }
      submittingRef.current = true;
      setSubmitState('submitting');
      try {
        const result = await scoreTest({ testId: phase.testId, answers: toAnswerList(phase.questions, answers) });
        heldAnswersRef.current = null;
        await endSession(uid, 'practice', phase.testId);
        setPhase({ kind: 'results', outcome: fromPracticeScore(result) });
      } catch (raw) {
        const error = toCallableError(raw);
        if (error.kind === 'already-exists') {
          // Graded already (an earlier response was lost): show what was saved.
          heldAnswersRef.current = null;
          await endSession(uid, 'practice', phase.testId);
          setPhase({ kind: 'recovering', testId: phase.testId });
        } else if (error.kind === 'not-found' || error.kind === 'permission-denied') {
          // Retrying can never work: drop the saved test and send the teen back to start fresh.
          console.warn('[practice] submit rejected', error);
          heldAnswersRef.current = null;
          await endSession(uid, 'practice', phase.testId);
          setPhase({ kind: 'rejected' });
        } else {
          console.warn('[practice] submit failed', error);
          setSubmitState('error');
        }
      } finally {
        submittingRef.current = false;
      }
    },
    [phase, uid, isOnline]
  );

  useEffect(() => {
    if (isOnline && submitState === 'waiting-for-connection' && heldAnswersRef.current) {
      const answers = heldAnswersRef.current;
      heldAnswersRef.current = null;
      void submit(answers);
    }
  }, [isOnline, submitState, submit]);

  // Leaving keeps the session on the phone, so it resumes from the Practice tab.
  usePreventRemove(phase.kind === 'running' && submitState !== 'submitting', ({ data }) => {
    Alert.alert('Leave the test?', 'Your answers are saved. You can resume it from the Practice tab.', [
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
    />
    );

  switch (phase.kind) {
    case 'loading':
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading the test" />
        </View>
      );
    case 'running':
      return (
        <QuizRunner
          key={phase.testId}
          questions={phase.questions}
          title="Practice test"
          initialAnswers={phase.initialAnswers}
          onAnswersChange={(answers) => {
            if (uid) void saveAnswers(uid, 'practice', phase.testId, answers);
          }}
          onSubmit={(answers) => void submit(answers)}
          submitState={submitState}
          isOnline={isOnline}
          notice={phase.notice}
        />
      );
    case 'recovering':
      return <Recovered testId={phase.testId} render={results} />;
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
function Recovered({ testId, render }: { testId: string; render: (o: PracticeOutcome) => React.ReactElement }) {
  const attempt = useTestAttempt(testId);
  const outcome = attempt.status === 'ready' ? fromPracticeAttempt(testId, attempt.data) : null;
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
