import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { openConcept } from '../navigation/openConcept';
import type { RootStackParamList } from '../navigation/types';
import { NoConnection } from '../components/NoConnection';
import { colors, radius, spacing, typography } from '../theme/tokens';
import {
  basisLine,
  hasEvidence,
  sortRows,
  STRENGTH_LABEL,
  type ReportRow,
  type ReportSort,
  type Strength,
} from './conceptStrength';
import { useConceptEvidence } from './useConceptEvidence';

// ph-4-us-6: the Progress tab's concept report. Every topic as strong / shaky / likely gap
// (or Got it / Missed it from the baseline alone), with what it's based on, sortable so the
// topics that need work come first. Tapping a topic opens its flashcards. Phase 5 adds the
// test date and outcome to this tab later.

const CHIP: Record<Strength, { backgroundColor: string; color: string }> = {
  strong: { backgroundColor: colors.successSoft, color: colors.success },
  'got-it': { backgroundColor: colors.successSoft, color: colors.success },
  shaky: { backgroundColor: colors.secondarySoft, color: colors.secondary },
  'likely-gap': { backgroundColor: colors.background, color: colors.alert },
  'missed-it': { backgroundColor: colors.background, color: colors.alert },
  'not-tested': { backgroundColor: colors.background, color: colors.inkSoft },
};

export function ConceptReportScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const evidence = useConceptEvidence();
  const [sort, setSort] = useState<ReportSort>('handbook');

  if (evidence.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading your progress" />
      </View>
    );
  }
  if (evidence.status === 'topics-error') {
    return <NoConnection message="Couldn't load your progress. Check your connection and try again." onRetry={evidence.retry} />;
  }

  const studyList = () => navigation.navigate('Main', { screen: 'Study', params: { screen: 'StudyHome' } });
  const notice = evidence.baselineError ? (
    <View style={styles.notice}>
      <Text style={[typography.small, styles.noticeText]}>Couldn't load your baseline.</Text>
      {evidence.retryBaseline && <Button label="Try again" variant="text" onPress={evidence.retryBaseline} />}
    </View>
  ) : null;

  if (!hasEvidence(evidence.rows)) {
    return (
      <View style={[styles.list, styles.content]}>
        {notice}
        <Text style={typography.h1}>Nothing to show yet</Text>
        <Text style={[typography.body, styles.muted]}>
          Take the baseline or a concept's mini-quiz, and this shows which concepts you've got and which need work.
        </Text>
        <Button label="Start your baseline" onPress={() => navigation.navigate('Baseline')} />
        <Button label="Go to the concept list" variant="secondary" onPress={studyList} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={sortRows(evidence.rows, sort)}
      keyExtractor={(row) => row.chunkId}
      ListHeaderComponent={
        <View style={styles.header}>
          {notice}
          <Text style={[typography.body, styles.muted]}>A rough guide from your quizzes and baseline.</Text>
          <View style={styles.sort} accessibilityRole="radiogroup">
            {(['handbook', 'needs-work'] as const).map((value) => (
              <Button
                key={value}
                label={value === 'handbook' ? 'Handbook order' : 'Needs work first'}
                variant={sort === value ? 'primary' : 'secondary'}
                onPress={() => setSort(value)}
                style={styles.sortButton}
              />
            ))}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <ReportRowView row={item} onOpen={() => openConcept(navigation, item.chunkId)} />
      )}
    />
  );
}

// The prop is `onOpen`, not `onPress`: testing-library's press walks up composite parents looking
// for an onPress, which would make the non-pressable coming-soon row fire.
function ReportRowView({ row, onOpen }: { row: ReportRow; onOpen: () => void }) {
  const label = STRENGTH_LABEL[row.result.strength];
  const basis = basisLine(row.result);
  const chip = CHIP[row.result.strength];
  const content = (
    <>
      <View style={styles.rowHeader}>
        <Text style={[typography.h2, styles.rowTitle]}>{row.title}</Text>
        <View style={[styles.chip, { backgroundColor: chip.backgroundColor }]}>
          <Text style={[typography.small, { color: chip.color }]}>{label}</Text>
        </View>
      </View>
      {/* "Not tested yet" is already the chip; don't say it twice. */}
      {row.result.source !== 'none' && <Text style={typography.small}>{basis}</Text>}
    </>
  );
  const a11y = [row.title, label, row.result.source !== 'none' ? basis : null].filter(Boolean).join(', ');
  if (row.comingSoon) {
    return (
      <Card style={styles.comingSoon}>
        <View accessible accessibilityLabel={a11y} style={styles.rowBody}>
          {content}
        </View>
      </Card>
    );
  }
  return (
    <Card onPress={onOpen} accessibilityLabel={a11y}>
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.space3 },
  muted: { color: colors.inkSoft },
  sort: { flexDirection: 'row', gap: spacing.space2 },
  sortButton: { flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noticeText: { color: colors.alert },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  rowTitle: { flex: 1 },
  rowBody: { gap: spacing.space2 },
  chip: { borderRadius: radius.chip, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.space2, paddingVertical: 2 },
  comingSoon: { backgroundColor: colors.background },
});
