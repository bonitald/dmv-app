import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';
import { Button } from './Button';

// The standard "No connection" state with a retry, shared by app start (App.tsx) and screens
// that need the network. `title` swaps the heading for failures that aren't the network's
// (e.g. "Something went wrong"), so the user isn't told to check a connection that's fine.
export function NoConnection({
  message,
  onRetry,
  title = 'No connection',
}: {
  message: string;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={typography.h1}>{title}</Text>
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
