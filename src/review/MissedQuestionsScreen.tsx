import { useMemo } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useBaselineProgress } from '../baseline/useBaselineProgress';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { NoConnection } from '../components/NoConnection';
import { openConcept } from '../navigation/openConcept';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { groupByTopic, latestMisses, type MissedQuestion } from './missedQuestions';
import { useRecentAttempts } from './useRecentAttempts';

// ph-4-us-5 (Slice 5b-2): every question whose latest graded result was a miss, by handbook
// topic. A plain list: no scores. A question opens on its own in Review; a topic's button opens
// its flashcards.
export function MissedQuestionsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const attempts = useRecentAttempts();
  const topics = useTopics();
  const baseline = useBaselineProgress();

  const sections = useMemo(() => {
    if (attempts.status !== 'ready') return [];
    const groups = groupByTopic(latestMisses(attempts.attempts), topics.status === 'ready' ? topics.topics : []);
    return groups.map((g) => ({ ...g, key: g.chunkId ?? 'other', data: g.questions }));
  }, [attempts, topics]);

  if (attempts.status === 'loading' || topics.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading your missed questions" />
      </View>
    );
  }
  if (attempts.status === 'error') {
    return (
      <NoConnection
        message="Your missed questions need a connection the first time they load."
        onRetry={() => navigation.goBack()}
        actionLabel="Back"
      />
    );
  }

  const practiceTab = () => navigation.navigate('Main', { screen: 'PracticeTests' });
  if (attempts.attempts.length === 0) {
    const baselineDone = baseline.status === 'complete';
    return (
      <View style={styles.empty}>
        <Text style={typography.h1}>No missed questions yet</Text>
        <Text style={[typography.body, styles.muted]}>
          Take the baseline or a practice test and any questions you miss will show here.
        </Text>
        {baselineDone ? (
          <Button label="Take a practice test" onPress={practiceTab} />
        ) : (
          <Button label="Start your baseline" onPress={() => navigation.navigate('Baseline')} />
        )}
      </View>
    );
  }
  if (sections.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={typography.h1}>Nothing to go over right now</Text>
        <Text style={[typography.body, styles.muted]}>
          Every question you've missed lately, you've since got right.
        </Text>
        <Button label="Take a practice test" onPress={practiceTab} />
        <Button label="Browse concepts" variant="secondary" onPress={() => navigation.navigate('Main', { screen: 'Study' })} />
      </View>
    );
  }

  return (
    <SectionList
      style={styles.screen}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(m) => m.questionId}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View style={styles.header}>
          <Text style={typography.h2} accessibilityRole="header">
            {`${section.title} · ${section.questions.length}`}
          </Text>
          {section.chunkId ? (
            <Button label="Study this concept" variant="text" onPress={() => openConcept(navigation, section.chunkId!)} />
          ) : null}
        </View>
      )}
      renderItem={({ item }) => <MissedRow missed={item} onPress={() => navigation.navigate('Review', { testId: item.testId, questionId: item.questionId })} />}
    />
  );
}

function MissedRow({ missed, onPress }: { missed: MissedQuestion; onPress: () => void }) {
  const text = missed.item.text ?? 'Question text unavailable';
  return (
    <Card onPress={onPress} accessibilityLabel={text} style={styles.row}>
      <Text style={typography.body} numberOfLines={2}>
        {text}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space2 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, backgroundColor: colors.background, padding: spacing.space5, gap: spacing.space3, justifyContent: 'center' },
  header: { marginTop: spacing.space4, gap: spacing.space1 },
  row: { marginBottom: spacing.space2 },
  muted: { color: colors.inkSoft },
});
