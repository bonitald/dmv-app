import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import type { RootStackScreenProps } from '../navigation/types';
import { TestDateField, useTestDateSelection } from '../profile/TestDateField';
import type { DateString } from '../profile/testDate';
import { colors, spacing, typography } from '../theme/tokens';
import { finishOnboarding } from './finishOnboarding';

// ph-9-us-3 step 3 / ph-9-us-5: optional test date, with a clear Skip.
export function OnboardingTestDateScreen({
  navigation,
  route,
}: RootStackScreenProps<'OnboardingTestDate'>) {
  const { uid } = useAuth();
  const { today, selected, setSelected } = useTestDateSelection(null);
  const [finishing, setFinishing] = useState(false);

  const finish = (testDate: DateString | null) => {
    if (!uid || finishing) return;
    setFinishing(true);
    void finishOnboarding(navigation, uid, route.params.choice, testDate);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={typography.h1} accessibilityRole="header">
        When’s your permit test?
      </Text>
      <Text style={[typography.body, styles.muted]}>
        Optional. If you know it, we’ll count down the days on your home screen. You can change it
        any time.
      </Text>
      <TestDateField today={today} selected={selected} onChange={setSelected} />
      <View style={styles.actions}>
        <Button label="Continue" onPress={() => finish(selected)} disabled={finishing} />
        <Button
          label="Skip for now"
          variant="text"
          onPress={() => finish(null)}
          disabled={finishing}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  muted: { color: colors.inkSoft },
  actions: { gap: spacing.space1, marginTop: spacing.space2 },
});
