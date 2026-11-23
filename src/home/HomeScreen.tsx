import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { useBaselineProgress } from '../baseline/useBaselineProgress';
import { Card } from '../components/Card';
import { getLastOpenedTopic } from '../profile/localFlags';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { TestDateCard } from './TestDateCard';
import { WeakSpotsCard } from './WeakSpotsCard';
import { usePracticeAttempts } from '../practice/usePracticeAttempts';
import { compareToBaseline, sinceBaselineLine } from '../progress/scoreComparison';
import { useBaselineScore } from '../progress/useBaselineScore';

// ph-9-us-7: Home only shows and links. Each card reads its own data and renders only once its
// feature exists, so Home fills in slice by slice (docs/build-order.md). Order, top to bottom:
// countdown, test card, study card, weak spots, then (later) driving summary, save progress.
// Both route cards always show, whichever route was picked at onboarding.
export function HomeScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <TestDateCard />
      <TestCard />
      <StudyCard />
      <WeakSpotsCard />
    </ScrollView>
  );
}

// ph-3-us-13: Start / Resume from users/{uid}/baseline/progress. Once the baseline is done it
// becomes the practice test card with the latest score and the change since the baseline
// (Slice 5b-2, ph-4-us-7). Baseline results stay reachable from the Progress tab and Recent tests.
function TestCard() {
  const navigation = useNavigation();
  const progress = useBaselineProgress();
  const open = () => navigation.navigate('Baseline');

  if (progress.status === 'in-progress') {
    return (
      <RouteCard
        icon="clipboard-outline"
        eyebrow="FIND OUT WHERE YOU STAND"
        title="Resume your baseline"
        body={`Section ${progress.currentSection} of ${progress.totalSections}. Pick up where you left off.`}
        onPress={open}
      />
    );
  }
  if (progress.status === 'complete') return <PracticeCard />;
  return (
    <RouteCard
      icon="clipboard-outline"
      eyebrow="FIND OUT WHERE YOU STAND"
      title="Start your baseline"
      body="3 sections of about 15 minutes, based on the Colorado Driver Handbook. Pause any time."
      onPress={open}
    />
  );
}

// ph-9-us-7 (Slice 4a): "Continue learning" names the last topic whose flashcards loaded on this
// device, read again each time Home comes back into view. Before any topic has been opened, or
// if that topic is no longer in the catalog, it's "Learn concept by concept". Either way it opens
// the concept list, so the user picks what to study rather than being dropped into a deck.
function StudyCard() {
  const navigation = useNavigation();
  const { uid } = useAuth();
  const topics = useTopics();
  const [lastOpened, setLastOpened] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let cancelled = false;
      getLastOpenedTopic(uid).then((chunkId) => {
        if (!cancelled) setLastOpened(chunkId);
      });
      return () => {
        cancelled = true;
      };
    }, [uid])
  );

  const topic =
    lastOpened && topics.status === 'ready'
      ? topics.topics.find((t) => t.chunkId === lastOpened)
      : undefined;

  const openList = () => navigation.navigate('Main', { screen: 'Study' });
  if (topic) {
    return (
      <RouteCard
        icon="book-outline"
        eyebrow="STUDY"
        title="Continue learning"
        body={topic.title}
        onPress={openList}
      />
    );
  }
  return (
    <RouteCard
      icon="book-outline"
      eyebrow="STUDY"
      title="Learn concept by concept"
      body="Flashcards and a quick quiz for each part of the handbook."
      onPress={openList}
    />
  );
}

function PracticeCard() {
  const navigation = useNavigation();
  const practice = usePracticeAttempts();
  const baseline = useBaselineScore();
  const latest = practice.status === 'ready' ? practice.attempts[0] : undefined;
  let body = '25 questions, like the real test.';
  if (latest) {
    const percent = Math.round((latest.correctCount / Math.max(1, latest.totalCount)) * 100);
    const comparison =
      baseline.status === 'ready' ? compareToBaseline(baseline.percent, latest.correctCount, latest.totalCount) : null;
    const since = comparison ? sinceBaselineLine(comparison) : null;
    body = `Latest: ${latest.correctCount} of ${latest.totalCount} (${percent}%)${since ? ` · ${since}` : ''}`;
  }
  return (
    <RouteCard
      icon="document-text-outline"
      eyebrow="PRACTICE TESTS"
      title="Take a practice test"
      body={body}
      onPress={() => navigation.navigate('Main', { screen: 'PracticeTests' })}
    />
  );
}

interface RouteCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  body: string;
  onPress: () => void;
}

function RouteCard({ icon, eyebrow, title, body, onPress }: RouteCardProps) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}. ${body}`}>
      <View style={styles.cardHeader}>
        <View style={styles.icon}>
          <Ionicons name={icon} size={22} color={colors.primary} />
        </View>
        <View style={styles.cardText}>
          <Text style={typography.caption}>{eyebrow}</Text>
          <Text style={typography.h2}>{title}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
      </View>
      <Text style={[typography.body, styles.muted]}>{body}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  cardText: { flex: 1, gap: 2 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { color: colors.inkSoft },
});
