import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, spacing, typography } from '../theme/tokens';
import { saveTestDate } from './profile';
import { useProfile } from './ProfileProvider';
import { TestDateField, useTestDateSelection } from './TestDateField';
import type { DateString } from './testDate';

// ph-9-us-5: change or remove the test date. Opened from Home's countdown / add-date card and
// from Settings. Closes straight away: Firestore applies the write to the local cache at once
// (so Home updates immediately, even offline) and syncs it later.
export function TestDateEditorScreen({ navigation }: RootStackScreenProps<'TestDateEditor'>) {
  const { uid } = useAuth();
  const { profile } = useProfile();
  const saved = profile?.testDate ?? null;
  const { today, selected, setSelected } = useTestDateSelection(saved);

  const save = (testDate: DateString | null) => {
    if (!uid) return;
    saveTestDate(uid, testDate).catch((error) =>
      console.warn('[test date] save failed', error)
    );
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={[typography.body, styles.muted]}>
        Pick the day of your written permit test.
      </Text>
      <TestDateField today={today} selected={selected} onChange={setSelected} />
      <View style={styles.actions}>
        <Button label="Save date" onPress={() => save(selected)} />
        {saved && (
          <Button label="Remove date" variant="secondary" onPress={() => save(null)} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  muted: { color: colors.inkSoft },
  actions: { gap: spacing.space2, marginTop: spacing.space2 },
});
