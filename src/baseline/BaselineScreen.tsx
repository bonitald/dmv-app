import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { getApp } from '@react-native-firebase/app';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { scoreTest, startOrResumeBaseline } from '../api/callables';
import { toCallableError } from '../api/callableErrors';
import type { BaselineSection } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { NoConnection } from '../components/NoConnection';
import { useIsOnline } from '../network/useIsOnline';
import { toAnswerList, type Answers } from '../quiz/answers';
import { QuizRunner, type SubmitState } from '../quiz/QuizRunner';
import { endSession, getActiveSession, saveAnswers, startSession } from '../quiz/quizSession';
import { colors } from '../theme/tokens';
import { BaselineCheckIn } from './BaselineCheckIn';
import { BaselineComplete } from './BaselineComplete';
import { BaselineIntro } from './BaselineIntro';
import { BASELINE_TOTAL_SECTIONS } from './baselineProgressData';
import { BaselineUnavailable } from './BaselineUnavailable';
import { useBaselineProgress } from './useBaselineProgress';

// ph-3-us-13 / ph-3-us-1: the baseline, one section at a time. The server holds which section
// the user is on (users/{uid}/baseline/progress); this device holds the current section's
// questions and answers (quizSession), so a force-quit or lost connection doesn't lose them.

type Phase =
  | { kind: 'loading' }
  | { kind: 'intro' }
  | { kind: 'running'; section: BaselineSection; initialAnswers: Answers; notice?: string }
  | { kind: 'check-in'; section: number; totalSections: number }
  | { kind: 'complete'; correctCount: number | null; totalCount: number | null }
  | { kind: 'unavailable' }
  | { kind: 'offline' };

const CACHE_WARNING =
  "This section can't be saved on your phone. Stay connected until you submit.";

/**
 * Rebuilds the section from a cached session when the server can't be reached. The testId
 * format `baseline-{version}-{section}` is set by startOrResumeBaseline (functions/README.md).
 */
function sectionFromCache(testId: string, questions: BaselineSection['questions']): BaselineSection {
  const [, version = 'v1', section = '1'] = testId.split('-');
  return {
    testId,
    version,
    section: Number(section) || 1,
    totalSections: BASELINE_TOTAL_SECTIONS,
    questions,
  };
}

export function BaselineScreen() {
  const navigation = useNavigation();
  const { uid } = useAuth();
  const progress = useBaselineProgress();
  const isOnline = useIsOnline();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const decidedRef = useRef(false);
  const submittingRef = useRef(false);
  const heldAnswersRef = useRef<Answers | null>(null);

  const goHome = useCallback(
    () => navigation.navigate('Main', { screen: 'Home' }),
    [navigation]
  );

  const load = useCallback(async () => {
    if (!uid) return;
    setPhase({ kind: 'loading' });
    setSubmitState('idle');
    try {
      const section = await startOrResumeBaseline();
      const active = await getActiveSession(uid);
      if (active?.testId === section.testId) {
        setPhase({ kind: 'running', section, initialAnswers: active.answers });
        return;
      }
      // New section, or the server moved on (e.g. finished on another device): start fresh.
      let notice: string | undefined;
      try {
        await startSession(uid, section.testId, 'baseline', section.questions);
      } catch (error) {
        console.warn('[baseline] caching the section failed', error);
        notice = CACHE_WARNING;
      }
      setPhase({ kind: 'running', section, initialAnswers: {}, notice });
    } catch (raw) {
      const error = toCallableError(raw);
      if (error.kind === 'already-exists') {
        setPhase({ kind: 'complete', correctCount: null, totalCount: null });
        return;
      }
      if (error.kind === 'failed-precondition') {
        console.warn('[baseline] unavailable', error.message);
        void logEvent(getAnalytics(getApp()), 'baseline_unavailable' as never, {
          code: error.code,
        });
        setPhase({ kind: 'unavailable' });
        return;
      }
      if (error.kind !== 'offline') console.warn('[baseline] start failed', error);
      // Can't reach the server, but this section's questions may be on the phone: keep going.
      const active = await getActiveSession(uid);
      if (active?.kind === 'baseline') {
        setPhase({
          kind: 'running',
          section: sectionFromCache(active.testId, active.questions),
          initialAnswers: active.answers,
        });
      } else {
        setPhase({ kind: 'offline' });
      }
    }
  }, [uid]);

  // Decide the first phase once progress has loaded. Later progress updates (scoreTest
  // advancing the section) don't move the user; the flow drives itself from there.
  useEffect(() => {
    if (decidedRef.current || progress.status === 'loading') return;
    decidedRef.current = true;
    if (progress.status === 'complete') {
      setPhase({ kind: 'complete', correctCount: null, totalCount: null });
    } else if (progress.status === 'not-started') {
      setPhase({ kind: 'intro' });
    } else {
      // In progress, or progress couldn't be read: the server knows which section is next.
      void load();
    }
  }, [progress, load]);

  const submit = useCallback(
    async (answers: Answers) => {
      if (phase.kind !== 'running' || !uid || submittingRef.current) return;
      // ph-3-us-1: offline, hold the answers; the reconnect effect below sends them.
      if (!isOnline) {
        heldAnswersRef.current = answers;
        setSubmitState('waiting-for-connection');
        return;
      }
      submittingRef.current = true;
      const { section } = phase;
      setSubmitState('submitting');
      let correctCount: number | null = null;
      let totalCount: number | null = null;
      try {
        const result = await scoreTest({
          testId: section.testId,
          answers: toAnswerList(section.questions, answers),
        });
        if (result.baselineReview) {
          correctCount = result.baselineReview.filter((q) => q.correct === true).length;
          totalCount = result.baselineReview.length;
        }
      } catch (raw) {
        const error = toCallableError(raw);
        // Includes 'offline' while NetInfo says online (e.g. the server can't be reached):
        // holding for a reconnect that never comes would stall, and re-sending at once would
        // loop, so the user gets Try again. Answers stay in quizSession either way.
        if (error.kind !== 'already-exists') {
          console.warn('[baseline] submit failed', error);
          setSubmitState('error');
          submittingRef.current = false;
          return;
        }
        // Already graded (e.g. the response was lost on an earlier try): move on.
      }
      heldAnswersRef.current = null;
      await endSession(uid, section.testId);
      submittingRef.current = false;
      setSubmitState('idle');
      if (section.section < section.totalSections) {
        setPhase({
          kind: 'check-in',
          section: section.section,
          totalSections: section.totalSections,
        });
      } else {
        setPhase({ kind: 'complete', correctCount, totalCount });
      }
    },
    [phase, uid, isOnline]
  );

  // ph-3-us-1: answers held while offline go out once the connection is back. `submit` moves
  // submitState on to 'submitting', so one hold is sent once. The answers also stay in
  // quizSession until grading, so a force-quit while waiting resumes like any other.
  useEffect(() => {
    if (isOnline && submitState === 'waiting-for-connection' && heldAnswersRef.current) {
      const answers = heldAnswersRef.current;
      heldAnswersRef.current = null;
      void submit(answers);
    }
  }, [isOnline, submitState, submit]);

  // ph-3-us-4: leaving mid-section asks first. Leaving keeps the section on the phone, so it
  // resumes next time.
  usePreventRemove(phase.kind === 'running' && submitState !== 'submitting', ({ data }) => {
    Alert.alert(
      'Take a break?',
      'Your answers are saved on this phone. Pick up where you left off any time.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ]
    );
  });

  switch (phase.kind) {
    case 'loading':
      return <View style={styles.blank} />;
    case 'intro':
      return <BaselineIntro onStart={() => void load()} />;
    case 'running': {
      const { section } = phase;
      return (
        <QuizRunner
          key={section.testId}
          questions={section.questions}
          title={`Section ${section.section} of ${section.totalSections}`}
          initialAnswers={phase.initialAnswers}
          onAnswersChange={(answers) => {
            if (uid) void saveAnswers(uid, section.testId, answers);
          }}
          onSubmit={(answers) => void submit(answers)}
          submitState={submitState}
          isOnline={isOnline}
          notice={phase.notice}
        />
      );
    }
    case 'check-in':
      return (
        <BaselineCheckIn
          section={phase.section}
          totalSections={phase.totalSections}
          onKeepGoing={() => void load()}
          onTakeBreak={goHome}
        />
      );
    case 'complete':
      return (
        <BaselineComplete
          correctCount={phase.correctCount}
          totalCount={phase.totalCount}
          onDone={goHome}
        />
      );
    case 'unavailable':
      return <BaselineUnavailable onDone={goHome} />;
    case 'offline':
      return (
        <NoConnection
          message="The baseline needs a connection to load. Check your connection and try again."
          onRetry={() => void load()}
        />
      );
  }
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.background },
});
