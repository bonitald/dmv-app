import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

// ph-2-us-5: the SCENARIO badge from the "Scenario question card" mockup, shared by the quiz
// card and the flashcard. Nothing for fact cards, or for a missing or unknown type.
export function ScenarioBadge({ type }: { type: string | null | undefined }) {
  if (type !== 'scenario') return null;
  return (
    <View style={styles.badge}>
      <Text style={[typography.caption, styles.text]}>SCENARIO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondarySoft,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.space2,
    paddingVertical: 2,
  },
  text: { color: colors.secondary },
});
