import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../theme/tokens';

// ph-3-us-13: the break point after sections 1 and 2. No score, and the two choices get equal
// weight: it isn't a nudge to continue.
export function BaselineCheckIn({
  section,
  totalSections,
  onKeepGoing,
  onTakeBreak,
}: {
  section: number;
  totalSections: number;
  onKeepGoing: () => void;
  onTakeBreak: () => void;
}) {
  return (
    <View style={styles.container}>
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`${section} of ${totalSections} sections done`}
      >
        {Array.from({ length: totalSections }, (_, i) => (
          <View key={i} style={[styles.dot, i < section && styles.dotDone]} />
        ))}
      </View>
      <Text style={typography.h1}>Section {section} done</Text>
      <Text style={[typography.body, styles.body]}>
        Nice work. Keep going, or take a break. We've saved your place.
      </Text>
      <View style={styles.buttons}>
        <Button
          label="Keep going"
          variant="secondary"
          onPress={onKeepGoing}
          style={styles.button}
        />
        <Button
          label="Take a break"
          variant="secondary"
          onPress={onTakeBreak}
          style={styles.button}
        />
      </View>
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
  dots: { flexDirection: 'row', gap: spacing.space2, marginBottom: spacing.space2 },
  dot: { width: 14, height: 14, borderRadius: radius.pill, backgroundColor: colors.line },
  dotDone: { backgroundColor: colors.primary },
  body: { textAlign: 'center', color: colors.inkSoft },
  buttons: {
    flexDirection: 'row',
    gap: spacing.space3,
    marginTop: spacing.space4,
    alignSelf: 'stretch',
  },
  button: { flex: 1 },
});
