import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme/tokens';

// ph-3-us-13: the baseline isn't published, or references a deleted question. A content
// problem on our side, not the user's. Practice tests arrive in Slice 5.
export function BaselineUnavailable({ onDone }: { onDone: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={[typography.body, styles.body]}>
        The baseline isn't available right now — try a practice test instead.
      </Text>
      <Button label="Back to Home" variant="secondary" onPress={onDone} style={styles.button} />
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
  body: { textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
