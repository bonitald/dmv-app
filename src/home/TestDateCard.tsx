import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { Card } from '../components/Card';
import { ADD_DATE_DISMISSED, getLocalFlag, setLocalFlag } from '../profile/localFlags';
import { useProfile } from '../profile/ProfileProvider';
import { countdownFor, daysUntil, longDateLabel } from '../profile/testDate';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { useToday } from './useToday';

// ph-9-us-5: Home's first card. With a date: a calm countdown, tap to change it. Without one: a
// dismissible "Add your test date" prompt (the date can still be set later from Settings).
// Phase 5 turns the "passed" state into the outcome prompt.
export function TestDateCard() {
  const navigation = useNavigation();
  const { uid } = useAuth();
  const { status, profile } = useProfile();
  const today = useToday();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (uid) getLocalFlag(ADD_DATE_DISMISSED, uid).then(setDismissed);
  }, [uid]);

  if (status !== 'ready' || !profile) return null;

  const openEditor = () => navigation.navigate('TestDateEditor');
  const days = daysUntil(profile.testDate, today);

  if (days === null) {
    if (dismissed !== false) return null;
    const dismiss = () => {
      setDismissed(true);
      if (uid) void setLocalFlag(ADD_DATE_DISMISSED, uid);
    };
    // Two sibling buttons rather than a button inside a pressable card, so screen readers can
    // reach Dismiss.
    return (
      <Card>
        <View style={styles.row}>
          <Pressable
            onPress={openEditor}
            accessibilityRole="button"
            accessibilityLabel="Add your test date"
            accessibilityHint="Opens a date picker"
            style={[styles.row, styles.text]}
          >
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            <View style={styles.text}>
              <Text style={typography.h2}>Add your test date</Text>
              <Text style={typography.small}>We’ll count down the days for you.</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            hitSlop={12}
          >
            <Ionicons name="close" size={20} color={colors.inkFaint} />
          </Pressable>
        </View>
      </Card>
    );
  }

  const countdown = countdownFor(days);
  const dateLabel = longDateLabel(profile.testDate!);

  return (
    <Card
      onPress={openEditor}
      accessibilityLabel={
        countdown.kind === 'days'
          ? `${countdown.days} ${countdown.label}, ${dateLabel}`
          : `${countdown.label}, ${dateLabel}`
      }
      accessibilityHint="Change or remove your test date"
      style={styles.countdown}
    >
      <View style={styles.row}>
        <View style={styles.text}>
          {countdown.kind === 'days' ? (
            <View style={styles.statRow}>
              <Text style={typography.stat}>{countdown.days}</Text>
              <Text style={typography.bodySemibold}>{countdown.label}</Text>
            </View>
          ) : (
            <Text style={typography.h1}>{countdown.label}</Text>
          )}
          <Text style={typography.small}>{dateLabel}</Text>
        </View>
        <Ionicons name="create-outline" size={20} color={colors.inkSoft} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  text: { flex: 1, gap: spacing.space1 },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.space2 },
  countdown: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft, borderRadius: radius.hero },
});
