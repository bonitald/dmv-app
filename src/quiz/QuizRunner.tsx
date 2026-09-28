import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { QuizQuestion } from '../api/types';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { countUnanswered, type Answers } from './answers';
import { QuizCard } from './QuizCard';

// ph-3-us-4: the shared test-taking runner. It holds answers and handles moving around and
// submitting. Each flow (baseline, practice test, mini-quiz) owns fetching, grading and what
// comes after, and tells the runner how a submit is going through `submitState`.

export type SubmitState = 'idle' | 'submitting' | 'waiting-for-connection' | 'error';

export interface QuizRunnerProps {
  questions: QuizQuestion[];
  /** Shown above the progress line, e.g. "Section 1 of 3". */
  title: string;
  /** Read once, on mount. */
  initialAnswers?: Answers;
  onAnswersChange?: (answers: Answers) => void;
  /** Called once per submit; ignored while a submit is in flight. */
  onSubmit: (answers: Answers) => void;
  submitState: SubmitState;
  isOnline: boolean;
  /** Optional line shown at the top, e.g. a cache-write warning. */
  notice?: string;
}

export function QuizRunner({
  questions,
  title,
  initialAnswers,
  onAnswersChange,
  onSubmit,
  submitState,
  isOnline,
  notice,
}: QuizRunnerProps) {
  const [answers, setAnswers] = useState<Answers>(() => initialAnswers ?? {});
  const [index, setIndex] = useState(0);
  // Guards against a double tap landing before the parent re-renders with 'submitting'.
  const submittedRef = useRef(false);
  if (submitState === 'error' || submitState === 'idle') submittedRef.current = false;

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const busy = submitState === 'submitting' || submitState === 'waiting-for-connection';

  function select(choice: string) {
    const next = { ...answers, [question.id]: choice };
    setAnswers(next);
    onAnswersChange?.(next);
  }

  function submitNow() {
    if (submittedRef.current || busy) return;
    submittedRef.current = true;
    onSubmit(answers);
  }

  function requestSubmit() {
    if (busy) return;
    const unanswered = countUnanswered(questions, answers);
    if (unanswered === 0) {
      submitNow();
      return;
    }
    Alert.alert(`${unanswered} unanswered`, 'Unanswered questions count as wrong.', [
      { text: 'Go back', style: 'cancel' },
      { text: 'Submit anyway', onPress: submitNow },
    ]);
  }

  return (
    <View style={styles.screen}>
      {!isOnline && submitState !== 'waiting-for-connection' && (
        <Banner text="You're offline. Keep going — your answers are saved on this phone." />
      )}
      {submitState === 'waiting-for-connection' && (
        <Banner text="Your answers are saved. We'll submit as soon as you're back online." />
      )}
      {notice && <Banner text={notice} />}

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.caption}>{title}</Text>
        <Text style={typography.small}>
          Question {index + 1} of {questions.length}
        </Text>
        <QuestionStrip questions={questions} answers={answers} current={index} onJump={setIndex} />
        <QuizCard question={question} selected={answers[question.id]} onSelect={select} />
      </ScrollView>

      <View style={styles.bar}>
        {submitState === 'error' && (
          <View style={styles.error}>
            <Text style={[typography.small, styles.errorText]}>
              Couldn't submit. Your answers are saved.
            </Text>
            <Button label="Try again" variant="text" onPress={submitNow} />
          </View>
        )}
        <View style={styles.barButtons}>
          <Button
            label="Back"
            variant="secondary"
            disabled={index === 0}
            onPress={() => setIndex(index - 1)}
            style={styles.barButton}
          />
          {isLast ? (
            <Button
              label={submitState === 'submitting' ? 'Submitting…' : 'Submit'}
              disabled={busy}
              onPress={requestSubmit}
              style={styles.barButton}
            />
          ) : (
            <Button label="Next" onPress={() => setIndex(index + 1)} style={styles.barButton} />
          )}
        </View>
      </View>
    </View>
  );
}

const CHIP_SIZE = 36;
const CHIP_GAP = spacing.space2;

/**
 * How far to scroll the question strip so the current chip sits in the middle of the visible
 * part, clamped to the strip's ends. Without this the current chip drifts off-screen once a
 * test has more questions than fit across (from about question 9 on a phone).
 */
export function stripScrollX(current: number, count: number, viewportWidth: number): number {
  const contentWidth = count * CHIP_SIZE + (count - 1) * CHIP_GAP;
  const maxX = Math.max(0, contentWidth - viewportWidth);
  const centred = current * (CHIP_SIZE + CHIP_GAP) + CHIP_SIZE / 2 - viewportWidth / 2;
  return Math.min(maxX, Math.max(0, centred));
}

function QuestionStrip({
  questions,
  answers,
  current,
  onJump,
}: {
  questions: QuizQuestion[];
  answers: Answers;
  current: number;
  onJump: (index: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  // Keep the current chip in view as the user moves through the questions.
  useEffect(() => {
    if (viewportWidth === 0) return;
    scrollRef.current?.scrollTo({
      x: stripScrollX(current, questions.length, viewportWidth),
      animated: true,
    });
  }, [current, questions.length, viewportWidth]);

  return (
    <ScrollView
      ref={scrollRef}
      testID="question-strip"
      onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {questions.map((q, i) => {
        const answered = answers[q.id] !== undefined;
        return (
          <Pressable
            key={q.id}
            onPress={() => onJump(i)}
            accessibilityRole="button"
            accessibilityLabel={`Question ${i + 1}${answered ? ', answered' : ''}`}
            hitSlop={6}
            style={[
              styles.chip,
              answered && styles.chipAnswered,
              i === current && styles.chipCurrent,
            ]}
          >
            <Text style={[typography.small, answered && styles.chipAnsweredText]}>{i + 1}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={[typography.small, styles.bannerText]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  strip: { gap: CHIP_GAP, paddingVertical: spacing.space1 },
  chip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAnswered: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  chipAnsweredText: { color: colors.primary },
  chipCurrent: { borderColor: colors.primary, borderWidth: 2 },
  bar: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.space4,
    gap: spacing.space2,
  },
  barButtons: { flexDirection: 'row', gap: spacing.space3 },
  barButton: { flex: 1 },
  error: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: colors.alert, flex: 1 },
  banner: {
    backgroundColor: colors.secondarySoft,
    paddingHorizontal: spacing.space5,
    paddingVertical: spacing.space2,
  },
  bannerText: { color: colors.ink },
});
