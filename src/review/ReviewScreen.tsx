import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { NoConnection } from '../components/NoConnection';
import { openConcept } from '../navigation/openConcept';
import type { RootStackParamList } from '../navigation/types';
import { QuizCard } from '../quiz/QuizCard';
import { stripScrollX } from '../quiz/QuizRunner';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { countMissed, isMissed, toReviewItems, type ReviewItem } from './reviewData';
import { useTestAttempt } from './useTestAttempt';

// ph-4-us-4: step through a graded attempt. Reads the saved attempt, so it works right after a
// test and later from history. The baseline reviews its final attempt's baselineReview (all 45);
// a baseline section before the last has no review, since its answers are still held back.

const OUTCOME_LABEL: Record<ReviewItem['outcome'], string> = {
  right: 'right',
  wrong: 'wrong',
  skipped: 'not answered',
  removed: 'removed',
};

export function ReviewScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { testId } = useRoute<RouteProp<RootStackParamList, 'Review'>>().params;
  const attempt = useTestAttempt(testId);
  const topics = useTopics();
  const attemptData = attempt.status === 'ready' ? attempt.data : undefined;
  const items = useMemo(
    () => (attempt.status === 'ready' ? toReviewItems(attemptData) : null),
    [attempt.status, attemptData]
  );
  // null = the user hasn't chosen yet, so the default follows the data: on when there's a miss.
  const [missedChoice, setMissedChoice] = useState<boolean | null>(null);
  const [noMisses, setNoMisses] = useState(false);
  const [index, setIndex] = useState(0);

  if (attempt.status === 'loading') return <View style={styles.blank} />;
  if (attempt.status === 'error') {
    return attempt.offline ? (
      <NoConnection
        message="This review needs a connection the first time it opens. Check your connection and try again."
        onRetry={attempt.retry}
      />
    ) : (
      <NoConnection
        title="Something went wrong"
        message="We couldn't load this review. Try again in a moment."
        onRetry={attempt.retry}
      />
    );
  }
  if (!items || items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={typography.h1}>No review yet</Text>
        <Text style={[typography.body, styles.soft, styles.centerText]}>
          Answers show once the whole baseline is done.
        </Text>
        <Button label="Back" onPress={() => navigation.goBack()} style={styles.stretch} />
      </View>
    );
  }

  const missedCount = countMissed(items);
  const missedOnly = (missedChoice ?? missedCount > 0) && missedCount > 0;
  const shown = missedOnly ? items.filter(isMissed) : items;
  const current = Math.min(index, shown.length - 1);
  const item = shown[current];
  const isLast = current === shown.length - 1;
  const topicTitle =
    topics.status === 'ready'
      ? topics.topics.find((t) => t.chunkId === item.chunkId)?.title
      : undefined;

  function toggleMissedOnly() {
    const next = !missedOnly;
    // Nothing missed: say so rather than showing an empty list.
    setNoMisses(next && missedCount === 0);
    setMissedChoice(next && missedCount > 0);
    setIndex(0);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={typography.caption}>REVIEW</Text>
            <Text style={typography.small}>
              Question {current + 1} of {shown.length}
            </Text>
          </View>
          <Pressable
            onPress={toggleMissedOnly}
            accessibilityRole="switch"
            accessibilityLabel="Missed only"
            accessibilityState={{ checked: missedOnly }}
            style={[styles.toggle, missedOnly && styles.toggleOn]}
          >
            <Text style={[typography.bodySemibold, missedOnly && styles.toggleOnText]}>
              Missed only
            </Text>
          </Pressable>
        </View>
        {noMisses && <Text style={[typography.small, styles.soft]}>No misses</Text>}

        <ReviewStrip items={shown} current={current} onJump={setIndex} />

        <ReviewBody item={item} />

        {item.outcome !== 'removed' &&
          (item.explanation ? (
            <Card>
              <Text style={typography.caption}>WHY</Text>
              <Text style={typography.body}>{item.explanation}</Text>
            </Card>
          ) : (
            <View style={styles.fallback}>
              <Text style={[typography.small, styles.soft]}>
                From the handbook: {topicTitle ?? 'this topic'}
              </Text>
              {item.chunkId && (
                <Button
                  label="Study this concept"
                  variant="text"
                  onPress={() => openConcept(navigation, item.chunkId!)}
                />
              )}
            </View>
          ))}
      </ScrollView>

      <View style={styles.bar}>
        <Button
          label="Back"
          variant="secondary"
          disabled={current === 0}
          onPress={() => setIndex(current - 1)}
          style={styles.barButton}
        />
        {isLast ? (
          <Button label="Done" onPress={() => navigation.goBack()} style={styles.barButton} />
        ) : (
          <Button label="Next" onPress={() => setIndex(current + 1)} style={styles.barButton} />
        )}
      </View>
    </View>
  );
}

/** The question itself, or what's left of it for removed questions and old attempts. */
function ReviewBody({ item }: { item: ReviewItem }) {
  if (item.outcome === 'removed') {
    return (
      <Card>
        <Text style={typography.h2}>This question was removed</Text>
        <Text style={[typography.small, styles.soft]}>It doesn't count toward your score.</Text>
      </Card>
    );
  }
  // Attempts saved before ph-4-us-3 only have the answers, not the question.
  if (item.text === null || item.choices === null) {
    return (
      <Card>
        <Text style={[typography.body, styles.soft]}>Question text unavailable</Text>
        <Text style={typography.body}>
          {item.choice === null ? 'Not answered' : `Your answer: ${item.choice}`}
        </Text>
        {item.correctAnswer !== null && (
          <Text style={[typography.bodySemibold, styles.right]}>
            Correct answer: {item.correctAnswer}
          </Text>
        )}
      </Card>
    );
  }
  return (
    <>
      {item.outcome === 'skipped' && (
        <Text style={[typography.bodySemibold, styles.wrong]}>Not answered</Text>
      )}
      <QuizCard
        question={{ text: item.text, choices: item.choices, type: item.type }}
        selected={undefined}
        review={{ choice: item.choice, correctAnswer: item.correctAnswer }}
      />
    </>
  );
}

const CHIP_SIZE = 36;

function ReviewStrip({
  items,
  current,
  onJump,
}: {
  items: ReviewItem[];
  current: number;
  onJump: (index: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  // Keep the current chip in view, as the quiz runner's strip does.
  useEffect(() => {
    if (viewportWidth === 0) return;
    scrollRef.current?.scrollTo({
      x: stripScrollX(current, items.length, viewportWidth),
      animated: true,
    });
  }, [current, items.length, viewportWidth]);

  return (
    <ScrollView
      ref={scrollRef}
      onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {items.map((item, i) => {
        const right = item.outcome === 'right';
        const missed = isMissed(item);
        return (
          <Pressable
            key={item.questionId}
            onPress={() => onJump(i)}
            accessibilityRole="button"
            accessibilityLabel={`Question ${i + 1}, ${OUTCOME_LABEL[item.outcome]}`}
            hitSlop={6}
            style={[
              styles.chip,
              right && styles.chipRight,
              missed && styles.chipMissed,
              i === current && styles.chipCurrent,
            ]}
          >
            <Text
              style={[
                typography.small,
                right && styles.chipRightText,
                missed && styles.chipMissedText,
              ]}
            >
              {i + 1}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.space5,
    gap: spacing.space3,
  },
  centerText: { textAlign: 'center' },
  stretch: { alignSelf: 'stretch', marginTop: spacing.space4 },
  soft: { color: colors.inkSoft },
  right: { color: colors.success },
  wrong: { color: colors.alert },
  content: { padding: spacing.space5, gap: spacing.space3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  headerText: { flex: 1, gap: spacing.space1 },
  toggle: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.space4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleOnText: { color: colors.surface },
  strip: { gap: spacing.space2, paddingVertical: spacing.space1 },
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
  chipRight: { backgroundColor: colors.successSoft, borderColor: colors.successSoft },
  chipRightText: { color: colors.success },
  chipMissed: { borderColor: colors.alert },
  chipMissedText: { color: colors.alert },
  chipCurrent: { borderWidth: 2, borderColor: colors.primary },
  fallback: { gap: spacing.space1 },
  bar: {
    flexDirection: 'row',
    gap: spacing.space3,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.space4,
  },
  barButton: { flex: 1 },
});
