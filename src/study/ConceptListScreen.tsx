import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { NoConnection } from '../components/NoConnection';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { STATUS_LABEL, toConceptRows, type ConceptRow } from './conceptList';
import type { ConceptStatus } from './conceptProgressData';
import { useConceptProgress } from './useConceptProgress';

// ph-2-us-7: the Study tab. Every handbook topic in order, each with the user's status, and
// any of them can be opened: no locked topics. Topics with no approved questions yet show as
// "coming soon". Statuses update live (Concept Progress is a subscription). If they can't be
// read, everything shows as not started rather than blocking the list.
const CHIP: Record<ConceptStatus, { backgroundColor: string; color: string }> = {
  'not-started': { backgroundColor: colors.background, color: colors.inkSoft },
  'in-progress': { backgroundColor: colors.primarySoft, color: colors.primary },
  reviewed: { backgroundColor: colors.successSoft, color: colors.success },
  'needs-revisit': { backgroundColor: colors.secondarySoft, color: colors.secondary },
};

export function ConceptListScreen() {
  const navigation = useNavigation();
  const topics = useTopics();
  const progress = useConceptProgress();

  if (topics.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading concepts" />
      </View>
    );
  }
  if (topics.status === 'error') {
    return (
      <NoConnection
        message="Couldn't load the concepts. Check your connection and try again."
        onRetry={topics.retry}
      />
    );
  }

  const rows = toConceptRows(topics.topics, progress.status === 'ready' ? progress.byChunk : {});
  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(row) => row.chunkId}
      ListHeaderComponent={
        <Text style={[typography.body, styles.muted]}>
          Start any concept, in any order, and start one over any time.
        </Text>
      }
      ListEmptyComponent={
        // Offline with nothing cached, Firestore can answer with an empty list instead of an
        // error, so an empty list also offers a retry.
        <View style={styles.empty}>
          <Text style={[typography.body, styles.muted]}>No concepts yet. Check back soon.</Text>
          <Button label="Try again" variant="secondary" onPress={topics.retry} />
        </View>
      }
      renderItem={({ item }) => (
        <ConceptRowView
          row={item}
          onPress={() => navigation.navigate('Flashcards', { chunkId: item.chunkId })}
        />
      )}
    />
  );
}

function ConceptRowView({ row, onPress }: { row: ConceptRow; onPress: () => void }) {
  const statusText = row.comingSoon ? 'Coming soon' : STATUS_LABEL[row.status];
  const label = [row.title, statusText, row.scorePercent === null ? null : `latest quiz ${row.scorePercent}%`]
    .filter(Boolean)
    .join(', ');
  const chip = row.comingSoon
    ? { backgroundColor: colors.background, color: colors.inkSoft }
    : CHIP[row.status];

  const content = (
    <>
      <View style={styles.rowHeader}>
        <Text style={[typography.h2, styles.rowTitle]}>{row.title}</Text>
        <View style={[styles.chip, { backgroundColor: chip.backgroundColor }]}>
          <Text style={[typography.small, { color: chip.color }]}>{statusText}</Text>
        </View>
      </View>
      {row.description !== '' && <Text style={typography.small}>{row.description}</Text>}
      {row.scorePercent !== null && (
        <Text style={typography.small}>{`Latest quiz: ${row.scorePercent}%`}</Text>
      )}
    </>
  );

  if (row.comingSoon) {
    return (
      <Card style={styles.comingSoon}>
        <View accessible accessibilityLabel={label} style={styles.rowBody}>
          {content}
        </View>
      </Card>
    );
  }
  return (
    <Card onPress={onPress} accessibilityLabel={label}>
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { gap: spacing.space3 },
  muted: { color: colors.inkSoft },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  rowTitle: { flex: 1 },
  rowBody: { gap: spacing.space2 },
  chip: {
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.space2,
    paddingVertical: 2,
  },
  comingSoon: { backgroundColor: colors.background },
});
