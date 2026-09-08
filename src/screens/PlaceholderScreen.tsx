import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

// ph-0-us-8: shared placeholder for every tab's initial stack screen. Later phases replace
// each tab's placeholder with real feature screens — this component itself goes away once
// no tab needs it anymore.
export function PlaceholderScreen({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <Text style={typography.h1}>{label}</Text>
      <Text style={[typography.body, styles.subtitle]}>Coming soon</Text>
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
  },
  subtitle: {
    color: colors.inkSoft,
  },
});
