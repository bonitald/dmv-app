import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { assembleMiniQuiz, scoreTest } from '../api/callables';
import { toCallableError } from '../api/callableErrors';
import type { QuizQuestion } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { NoConnection } from '../components/NoConnection';
import type { RootStackScreenProps } from '../navigation/types';
import { useIsOnline } from '../network/useIsOnline';
import { useTestAttempt } from '../review/useTestAttempt';
import { recordQuizResults } from '../study/cardPerformance';
import { markOpened, setStatusFromChoice } from '../study/conceptProgress';
import { progressFor, type NextStepChoice } from '../study/conceptProgressData';
import { useConceptProgress } from '../study/useConceptProgress';
import { colors, spacing, typography } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { toAnswerList, type Answers } from './answers';
import {
  fromAttempt,
  fromScoreResult,
  lastQuizIds,
  rememberQuiz,
  type MiniQuizOutcome,
} from './miniQuizData';
import { MiniQuizResults } from './MiniQuizResults';
import { QuizRunner, type SubmitState } from './QuizRunner';

// ph-2-us-8 / ph-2-us-9: one topic's mini-quiz on the shared runner, then its results and the
// two next steps. Not kept in quizSession (that holds one active test, the baseline's): a
// killed quiz is simply abandoned and the next one gets a new testId. Offline at submit, the
// answers are held on screen and sent on reconnect.

type Phase =
  | { kind: 'loading' }
  | { kind: 'running'; testId: string; questions: QuizQuestion[] }
  | { kind: 'results'; outcome: MiniQuizOutcome }
  /** scoreTest said it was already graded: read the saved attempt instead. */
  | { kind: 'recovering'; testId: string }
  | { kind: 'empty' }
  | { kind: 'offline' }
  | { kind: 'error' };

export function MiniQuizScreen({ navigation, route }: RootStackScreenProps<'MiniQuiz'>) {
  const { chunkId } = route.params;
  const { uid } = useAuth();
  const isOnline = useIsOnline();
  const progress = useConceptProgress();
  const topics = useTopics();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const submittingRef = useRef(false);
  const heldAnswersRef = useRef<Answers | null>(null);
  const choseRef = useRef(false);

  const title = topics.status === 'ready' ? topics.topics.find((t) => t.chunkId === chunkId)?.title : undefined;
  useEffect(() => {
    if (title) navigation.setOptions({ title: `Mini-quiz · ${title}` });
  }, [navigation, title]);

  // Opening the quiz counts as opening the topic once it has loaded, from a known status only (ph-2-us-10).
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || !uid || phase.kind !== 'running' || progress.status !== 'ready' || progress.cachedEmpty) return;
    marked.current = true;
    markOpened(uid, chunkId, progressFor(progress.byChunk, chunkId).status);
  }, [uid, chunkId, progress, phase.kind]);

  const load = useCallback(async () => {
    if (!uid) return;
    setPhase({ kind: 'loading' });
    setSubmitState('idle');
    try {
      // No count: the server sizes the quiz from the topic (Slice 4b).
      const { testId, questions } = await assembleMiniQuiz({ chunkId, excludeIds: lastQuizIds(chunkId) });
      rememberQuiz(chunkId, questions.map((q) => q.id));
      setPhase({ kind: 'running', testId, questions });
    } catch (raw) {
      const error = toCallableError(raw);
      if (error.kind !== 'offline') console.warn('[miniQuiz] load failed', error);
      setPhase({ kind: error.kind === 'not-found' ? 'empty' : error.kind === 'offline' ? 'offline' : 'error' });
    }
  }, [uid, chunkId]);

  useEffect(() => {
    void load();
  }, [load]);

  const showResults = useCallback(
    async (outcome: MiniQuizOutcome) => {
      if (uid) await recordQuizResults(uid, outcome.perQuestion);
      setPhase({ kind: 'results', outcome });
    },
    [uid]
  );

  const submit = useCallback(
    async (answers: Answers) => {
      if (phase.kind !== 'running' || submittingRef.current) return;
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
        await showResults(fromScoreResult(result));
      } catch (raw) {
        const error = toCallableError(raw);
        if (error.kind === 'already-exists') {
          // Graded already (an earlier response was lost): show what was saved.
          setPhase({ kind: 'recovering', testId: phase.testId });
        } else {
          console.warn('[miniQuiz] submit failed', error);
          setSubmitState('error');
        }
      } finally {
        submittingRef.current = false;
      }
    },
    [phase, isOnline, showResults]
  );

  useEffect(() => {
    if (isOnline && submitState === 'waiting-for-connection' && heldAnswersRef.current) {
      const answers = heldAnswersRef.current;
      heldAnswersRef.current = null;
      void submit(answers);
    }
  }, [isOnline, submitState, submit]);

  usePreventRemove(phase.kind === 'running' && submitState !== 'submitting', ({ data }) => {
    Alert.alert('Leave the quiz?', "Your answers won't be saved. You can take a new quiz any time.", [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const choose = useCallback(
    (choice: NextStepChoice) => {
      if (choseRef.current || !uid) return;
      choseRef.current = true;
      setStatusFromChoice(uid, chunkId, choice); // queued by Firestore offline; never awaited
      if (choice === 'review-again') {
        navigation.popTo('Flashcards', { chunkId, pass: { mode: 'missed-only', nonce: Date.now() } });
        return;
      }
      navigation.popTo('Main', { screen: 'Study', params: { screen: 'StudyHome' } });
    },
    [uid, chunkId, navigation]
  );

  switch (phase.kind) {
    case 'loading':
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading the quiz" />
        </View>
      );
    case 'running':
      return (
        <QuizRunner
          key={phase.testId}
          questions={phase.questions}
          title={title ? `Mini-quiz · ${title}` : 'Mini-quiz'}
          onSubmit={(answers) => void submit(answers)}
          submitState={submitState}
          isOnline={isOnline}
        />
      );
    case 'recovering':
      return <Recovered testId={phase.testId} onReady={(o) => void showResults(o)} />;
    case 'results':
      return (
        <MiniQuizResults
          outcome={phase.outcome}
          onChoice={choose}
          onReview={() => navigation.navigate('Review', { testId: phase.outcome.testId })}
        />
      );
    case 'empty':
      return (
        <View style={styles.center}>
          <Text style={typography.h1}>Nothing here yet</Text>
          <Text style={[typography.body, styles.muted]}>Questions for this concept are still being written.</Text>
          <Button label="Back" onPress={() => navigation.goBack()} style={styles.wide} />
        </View>
      );
    case 'offline':
      return <NoConnection message="The quiz needs a connection to load. Check your connection and try again." onRetry={() => void load()} />;
    case 'error':
      return <NoConnection title="Something went wrong" message="We couldn't load the quiz. Try again in a moment." onRetry={() => void load()} />;
  }
}

/** Reads the saved attempt after `already-exists`, then hands its outcome up once. */
function Recovered({ testId, onReady }: { testId: string; onReady: (o: MiniQuizOutcome) => void }) {
  const attempt = useTestAttempt(testId);
  const outcome = attempt.status === 'ready' ? fromAttempt(testId, attempt.data) : null;
  const sent = useRef(false);
  useEffect(() => {
    if (outcome && !sent.current) {
      sent.current = true;
      onReady(outcome);
    }
  }, [outcome, onReady]);

  if (attempt.status === 'error' || (attempt.status === 'ready' && !outcome)) {
    return (
      <NoConnection
        title={attempt.status === 'error' && attempt.offline ? 'No connection' : 'Something went wrong'}
        message="Your quiz was graded, but its results couldn't load. Try again."
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
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.space5,
    gap: spacing.space2,
  },
  muted: { color: colors.inkSoft, textAlign: 'center' },
  wide: { marginTop: spacing.space5, paddingHorizontal: spacing.space6 },
});
