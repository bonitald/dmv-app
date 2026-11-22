import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import type { RootStackParamList } from '../navigation/types';
import { usePracticeAttempts } from '../practice/usePracticeAttempts';
import { colors, spacing, typography } from '../theme/tokens';
import { compareToBaseline, comparisonLine } from './scoreComparison';
import { useBaselineScore } from './useBaselineScore';

// ph-4-us-7: the top of the Progress tab: baseline, latest practice test, and the change. Hidden
// while loading or when the baseline can't be read, so it never blocks the concept report.
export function ScoreSummaryCard() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const baseline = useBaselineScore();
  const practice = usePracticeAttempts();

  if (baseline.status === 'loading' || baseline.status === 'unknown') return null;
  if (baseline.status === 'none' || baseline.status === 'in-progress') {
    return (
      <Card>
        <Text style={typography.h2}>Your scores</Text>
        <Text style={[typography.body, styles.muted]}>Your baseline is where progress is measured from.</Text>
        <Button
          label={baseline.status === 'none' ? 'Start your baseline' : 'Finish your baseline'}
          variant="secondary"
          onPress={() => navigation.navigate('Baseline')}
        />
      </Card>
    );
  }

  const latest = practice.status === 'ready' ? practice.attempts[0] : undefined;
  const comparison = latest ? compareToBaseline(baseline.percent, latest.correctCount, latest.totalCount) : null;
  return (
    <Card>
      <Text style={typography.h2}>Your scores</Text>
      <View style={styles.lines}>
        <Text style={typography.body}>{`Baseline ${baseline.percent}%`}</Text>
        {comparison ? (
          <>
            <Text style={typography.body}>{`Latest practice test ${comparison.practicePercent}%`}</Text>
            <Text style={typography.bodySemibold}>{comparisonLine(comparison, 'Latest')}</Text>
          </>
        ) : practice.status === 'ready' ? (
          <>
            <Text style={[typography.body, styles.muted]}>Take a practice test to compare with your baseline.</Text>
            <Button
              label="Take a practice test"
              variant="secondary"
              onPress={() => navigation.navigate('Main', { screen: 'PracticeTests' })}
            />
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  lines: { gap: spacing.space1 },
  muted: { color: colors.inkSoft },
});
