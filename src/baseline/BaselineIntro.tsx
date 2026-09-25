import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme/tokens';

// ph-3-us-13: shown once, before section 1. Resuming goes straight into the section.
const POINTS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'list-outline', text: '45 questions in 3 sections of 15' },
  { icon: 'book-outline', text: 'One question for each part of the Colorado Driver Handbook' },
  { icon: 'pause-circle-outline', text: 'Take a break between sections. We save your place.' },
  { icon: 'flag-outline', text: "It's a starting point, not a pass or fail" },
];

export function BaselineIntro({ onStart }: { onStart: () => void }) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={typography.caption}>FIND OUT WHERE YOU STAND</Text>
      <Text style={typography.h1}>Baseline test</Text>
      <View style={styles.points}>
        {POINTS.map((point) => (
          <View key={point.text} style={styles.point}>
            <Ionicons name={point.icon} size={22} color={colors.primary} />
            <Text style={[typography.body, styles.pointText]}>{point.text}</Text>
          </View>
        ))}
      </View>
      <Button label="Start section 1" onPress={onStart} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space4 },
  points: { gap: spacing.space3, marginVertical: spacing.space2 },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  pointText: { flex: 1 },
});
