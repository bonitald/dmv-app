import { ScrollView, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../components/Card';
import { useProfile } from '../profile/ProfileProvider';
import { longDateLabel } from '../profile/testDate';
import { colors, spacing, typography } from '../theme/tokens';

// ph-9-us-7's Settings entry point (gear on Home). Slice 1 holds the test date, which stays
// reachable here after Home's "add date" card is dismissed. Account state, sign-out and
// "Delete my data" arrive with ph-9-us-10 (Slice 6).
export function SettingsScreen() {
  const navigation = useNavigation();
  const { profile } = useProfile();
  const testDate = profile?.testDate ?? null;
  const value = testDate ? longDateLabel(testDate) : 'Not set';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={typography.caption}>YOUR TEST</Text>
      <Card
        onPress={() => navigation.navigate('TestDateEditor')}
        accessibilityLabel={`Test date: ${value}`}
        accessibilityHint={testDate ? 'Change or remove your test date' : 'Add your test date'}
      >
        <Text style={typography.bodySemibold}>Test date</Text>
        <Text style={[typography.body, styles.muted]}>{value}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space2 },
  muted: { color: colors.inkSoft },
});
