import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../theme/tokens';
import type { Topic } from '../topics/topicsData';
import { compareToBaseline, comparisonLine } from '../progress/scoreComparison';
import { useBaselineScore } from '../progress/useBaselineScore';
import {
  leftOutLine,
  passLine,
  passed,
  percentLine,
  scoreLine,
  timedOutLine,
  topicsToWorkOn,
  type PracticeOutcome,
} from './practiceData';

// ph-4-us-1 / ph-4-us-6: a finished practice test: score, the pass line against the real test's
// mark, and the topics to work on. Shown after a test and when reopening one. Presentational
// only; the copy comes from practiceData. Encouraging, never graded-feeling.

export function PracticeResults({
  outcome,
  topics,
  onOpenTopic,
  onReview,
  onTakeAnother,
  onBack,
  onOpenMissed,
}: {
  outcome: PracticeOutcome;
  topics: Topic[];
  onOpenTopic: (chunkId: string) => void;
  onReview: () => void;
  onTakeAnother: () => void;
  onBack: () => void;
  /** ph-4-us-5: opens the missed questions list. */
  onOpenMissed?: () => void;
}) {
  const { shown, moreCount } = topicsToWorkOn(outcome.perTopic, topics);
  const leftOut = leftOutLine(outcome);
  const timedOut = timedOutLine(outcome);
  const baseline = useBaselineScore();
  const comparison =
    baseline.status === 'ready' ? compareToBaseline(baseline.percent, outcome.correctCount, outcome.totalCount) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={typography.stat} accessibilityRole="header">
        {scoreLine(outcome)}
      </Text>
      <Text style={typography.body}>{percentLine(outcome)}</Text>
      {timedOut ? <Text style={[typography.small, styles.muted]}>{timedOut}</Text> : null}
      <Text style={[typography.bodySemibold, { color: passed(outcome) ? colors.success : colors.ink }]}>
        {passLine(outcome)}
      </Text>
      {leftOut ? <Text style={[typography.small, styles.muted]}>{leftOut}</Text> : null}
      {comparison ? (
        <Text style={typography.body}>{comparisonLine(comparison, 'This test')}</Text>
      ) : baseline.status === 'in-progress' ? (
        <Text style={[typography.body, styles.muted]}>Finish your baseline to see how far you've come.</Text>
      ) : null}

      <Text style={typography.h2}>Topics to work on</Text>
      {shown.length === 0 ? (
        <Text style={[typography.body, styles.muted]}>You didn't miss a single topic.</Text>
      ) : (
        shown.map((row) => (
          <Card
            key={row.chunkId}
            onPress={() => onOpenTopic(row.chunkId)}
            accessibilityLabel={`${row.title}, ${row.missed} missed`}
          >
            <View style={styles.row}>
              <Text style={[typography.bodySemibold, styles.rowTitle]}>{row.title}</Text>
              <Text style={typography.small}>{`${row.missed} missed`}</Text>
            </View>
          </Card>
        ))
      )}
      {moreCount > 0 ? (
        <Text style={[typography.small, styles.muted]}>{`and ${moreCount} more — see Review answers`}</Text>
      ) : null}

      <View style={styles.actions}>
        <Button label="Take another test" variant="primary" onPress={onTakeAnother} />
        <Button label="Review answers" variant="secondary" onPress={onReview} />
        {onOpenMissed ? <Button label="Go over missed questions" variant="secondary" onPress={onOpenMissed} /> : null}
        <Button label="Back to Practice" variant="text" onPress={onBack} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space3 },
  rowTitle: { flex: 1 },
  muted: { color: colors.inkSoft },
  actions: { gap: spacing.space2, marginTop: spacing.space3 },
});
