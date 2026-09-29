import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { PerQuestionResult } from '../api/types';
import { Button } from '../components/Button';
import { NoConnection } from '../components/NoConnection';
import { openConcept } from '../navigation/openConcept';
import type { RootStackParamList } from '../navigation/types';
import { toReviewItems } from '../review/reviewData';
import { useTestAttempt } from '../review/useTestAttempt';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { summarizeBaseline, trackingLine, type TopicResult } from './baselineResultsData';

// ph-4-us-6 (baseline results part): score, how it tracks against the real test's 80% mark,
// and Got it / Missed it per topic, with links into study and the 45-question review. Replaces
// Slice 2's placeholder. The Progress-tab concept report is Slice 4b.

const RESULT_LABEL: Record<TopicResult, string> = {
  'got-it': 'Got it',
  'missed-it': 'Missed it',
  'not-tested': 'Not tested',
};

export function BaselineResults({
  review,
  testId,
  onDone,
}: {
  /** Right after submit: the final section's baselineReview. Null when reopened later. */
  review: PerQuestionResult[] | null;
  /** The final attempt to load (and to open in Review), e.g. baseline-v1-3. */
  testId: string;
  onDone: () => void;
}) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  // No read when the results are already in memory.
  const attempt = useTestAttempt(review ? null : testId);
  const topics = useTopics();
  const attemptData = attempt.status === 'ready' ? attempt.data : undefined;
  const items = useMemo(
    () =>
      review
        ? toReviewItems({ type: 'baseline', baselineReview: review })
        : toReviewItems(attemptData),
    [review, attemptData]
  );

  if (!review && attempt.status === 'loading') return <View style={styles.blank} />;
  if (!review && attempt.status === 'error' && attempt.offline) {
    return (
      <NoConnection
        message="Your results need a connection the first time they load. Check your connection and try again."
        onRetry={attempt.retry}
      />
    );
  }
  if (!items) {
    return (
      <NoConnection
        title="Something went wrong"
        message="We couldn't load your results. Try again in a moment."
        onRetry={attempt.retry}
      />
    );
  }

  // Titles fill in when the catalog arrives; until then (or if it fails) rows use chunkIds.
  const summary = summarizeBaseline(items, topics.status === 'ready' ? topics.topics : []);
  const firstMissed = summary.firstMissedChunkId;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={typography.h1}>Your baseline results</Text>
      <View
        accessible
        accessibilityLabel={`${summary.percent}%, ${summary.correctCount} of ${summary.totalCount} right`}
      >
        <Text style={typography.display}>{summary.percent}%</Text>
        <Text style={typography.bodySemibold}>
          {summary.correctCount} of {summary.totalCount} right
        </Text>
      </View>
      <Text style={typography.body}>{trackingLine(summary)}</Text>

      <View style={styles.actions}>
        {firstMissed && (
          <Button
            label="Start with what you missed"
            onPress={() => openConcept(navigation, firstMissed)}
          />
        )}
        <Button
          label="Review answers"
          variant="secondary"
          onPress={() => navigation.navigate('Review', { testId })}
        />
      </View>

      <View style={styles.topicsHeader}>
        <Text style={typography.caption}>BY TOPIC</Text>
        <Text style={typography.small}>One question per topic, so this is only a rough guide.</Text>
      </View>
      <View style={styles.topicList}>
        {summary.topics.map((topic) => (
          <Pressable
            key={topic.chunkId}
            onPress={() => openConcept(navigation, topic.chunkId)}
            accessibilityRole="button"
            accessibilityLabel={`${topic.title}, ${RESULT_LABEL[topic.result]}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={[typography.body, styles.rowTitle]}>{topic.title}</Text>
            <View style={[styles.pill, pillStyles[topic.result]]}>
              <Text style={[typography.small, pillTextStyles[topic.result]]}>
                {RESULT_LABEL[topic.result]}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Button label="Back to Home" variant="text" onPress={onDone} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space4 },
  actions: { gap: spacing.space3 },
  topicsHeader: { gap: spacing.space1, marginTop: spacing.space2 },
  topicList: { gap: spacing.space2 },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space3,
    paddingHorizontal: spacing.space4,
    paddingVertical: spacing.space3,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  rowTitle: { flex: 1 },
  pressed: { opacity: 0.85 },
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.space2,
    paddingVertical: 2,
  },
});

const pillStyles = StyleSheet.create({
  'got-it': { backgroundColor: colors.successSoft, borderColor: colors.successSoft },
  'missed-it': { backgroundColor: colors.surface, borderColor: colors.alert },
  'not-tested': { backgroundColor: colors.surface, borderColor: colors.line },
});

const pillTextStyles = StyleSheet.create({
  'got-it': { color: colors.success },
  'missed-it': { color: colors.alert },
  'not-tested': { color: colors.inkSoft },
});
