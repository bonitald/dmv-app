import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme/tokens';

// ph-3-us-13: minimal placeholder for the baseline results screen (ph-4-us-6, Slice 3).
export function BaselineComplete({
  correctCount,
  totalCount,
  onDone,
}: {
  correctCount: number | null;
  totalCount: number | null;
  onDone: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Baseline done</Text>
      {correctCount !== null && totalCount !== null && (
        <Text style={[typography.stat, styles.center]}>
          You got {correctCount} of {totalCount} right.
        </Text>
      )}
      <Text style={[typography.body, styles.center, styles.body]}>
        Your results for each part of the handbook arrive in the next build.
      </Text>
      <Button label="Back to Home" onPress={onDone} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.space5,
    gap: spacing.space3,
  },
  center: { textAlign: 'center' },
  body: { color: colors.inkSoft },
  button: { marginTop: spacing.space4, alignSelf: 'stretch' },
});
