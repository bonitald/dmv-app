import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';
import { Button } from './Button';

// The standard "No connection" state with a retry, shared by app start (App.tsx) and screens
// that need the network.
export function NoConnection({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={typography.h1}>No connection</Text>
      <Text style={[typography.body, styles.message]}>{message}</Text>
      <Button label="Try again" onPress={onRetry} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.space5,
    gap: spacing.space2,
  },
  message: { textAlign: 'center', color: colors.inkSoft },
  button: { marginTop: spacing.space5, paddingHorizontal: spacing.space6 },
});
