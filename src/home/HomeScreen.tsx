import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { TestDateCard } from './TestDateCard';

// ph-9-us-7: Home only shows and links. Each card reads its own data and renders only once its
// feature exists, so Home fills in slice by slice (docs/build-order.md). Order, top to bottom:
// countdown, test card, study card, then (later) weak spots, driving summary, save progress.
// Both route cards always show, whichever route was picked at onboarding.
export function HomeScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <TestDateCard />
      <TestCard />
      <StudyCard />
    </ScrollView>
  );
}

// Slice 1: always "Start your baseline". Slice 2 (ph-3-us-13) adds Resume from
// users/{uid}/baseline/progress, and Slice 5 swaps in practice tests once the baseline is done.
function TestCard() {
  const navigation = useNavigation();
  return (
    <RouteCard
      icon="clipboard-outline"
      eyebrow="FIND OUT WHERE YOU STAND"
      title="Start your baseline"
      body="3 sections of about 15 minutes, based on the Colorado Driver Handbook. Pause any time."
      onPress={() => navigation.navigate('Baseline')}
    />
  );
}

// Slice 1: links to the Study tab. Slice 4 (ph-2-us-7/12) makes it "Continue learning" with the
// next concept to study.
function StudyCard() {
  const navigation = useNavigation();
  return (
    <RouteCard
      icon="book-outline"
      eyebrow="STUDY"
      title="Learn concept by concept"
      body="Flashcards and a quick quiz for each part of the handbook."
      onPress={() => navigation.navigate('Main', { screen: 'Study' })}
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
