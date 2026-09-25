import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

// ph-0-us-8: shared placeholder for screens whose feature isn't built yet (tab roots). Later
// slices replace each use — this component itself goes away once nothing needs it anymore. `note` is an optional line under "Coming soon".
export function PlaceholderScreen({ label, note }: { label: string; note?: string }) {
  return (
    <View style={styles.container}>
      <Text style={typography.h1}>{label}</Text>
      <Text style={[typography.body, styles.subtitle]}>Coming soon</Text>
      {note && <Text style={[typography.small, styles.note]}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.space2,
    paddingHorizontal: spacing.space5,
  },
  subtitle: {
    color: colors.inkSoft,
  },
  note: {
    textAlign: 'center',
  },
});
