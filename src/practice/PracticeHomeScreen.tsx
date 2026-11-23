import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import type { RootStackParamList } from '../navigation/types';
import type { TestMode } from '../api/types';
import { getPracticeMode, setPracticeMode } from '../profile/localFlags';
import { endSession, getActiveSession, type ActiveSession } from '../quiz/quizSession';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { attemptDateLabel, passed, type PracticeOutcome } from './practiceData';
import { startPracticeTest } from './startPracticeTest';
import { isExpired, remainingSeconds, TIMED_TEST_LIMIT_SEC } from './timing';
import { usePracticeAttempts } from './usePracticeAttempts';
import { latestMisses } from '../review/missedQuestions';
import { useRecentAttempts } from '../review/useRecentAttempts';

// ph-3-us-4 / ph-4-us-1: the Practice tab. Start a test, resume or discard the one saved on the
// phone, and reopen the results of recent tests. The saved session is re-read on every focus so
// the card is right after coming back from a test.

export function PracticeHomeScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { uid } = useAuth();
  const attempts = usePracticeAttempts();
  const recent = useRecentAttempts();
  const [saved, setSaved] = useState<ActiveSession | null>(null);
  const [readAt, setReadAt] = useState(() => Date.now());
  const [mode, setMode] = useState<TestMode>('untimed');

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void getPracticeMode(uid).then((savedMode) => {
      if (!cancelled) setMode(savedMode);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let cancelled = false;
      getActiveSession(uid, 'practice')
        .then((session) => {
          if (cancelled) return;
          setReadAt(Date.now());
          setSaved(session);
        })
        .catch((error) => console.warn('[practice] reading the saved test failed', error));
      return () => {
        cancelled = true;
      };
    }, [uid])
  );

  // Coming back to the app after a while: refresh the clock so the card can flip to expired.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setReadAt(Date.now());
    });
    return () => subscription.remove();
  }, []);

  // Time left on a timed saved test, worked out when the saved test is read (on focus).
  const timeLeftSec =
    saved?.timing?.mode === 'timed'
      ? remainingSeconds(saved.timing.startedAt, saved.timing.timeLimitSec ?? TIMED_TEST_LIMIT_SEC, readAt)
      : null;
  const expired = timeLeftSec === 0;

  const chooseMode = (next: TestMode) => {
    setMode(next);
    if (uid) void setPracticeMode(uid, next);
  };

  // The card can be on screen while time runs out, so Discard re-checks at tap time and at
  // confirm time: an expired test is opened (and graded), never deleted.
  const openIfExpired = () => {
    if (!saved || !isExpired(saved.timing, Date.now())) return false;
    setReadAt(Date.now());
    navigation.navigate('PracticeTest', { resume: true });
    return true;
  };

  const discard = () => {
    if (openIfExpired()) return;
    Alert.alert('Discard this test?', 'Your answers will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          if (!uid || !saved || openIfExpired()) return;
          void endSession(uid, 'practice', saved.testId).then(() => setSaved(null));
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={typography.h1} accessibilityRole="header">
        Practice tests
      </Text>
      <Text style={[typography.body, styles.muted]}>
        25 questions, like the real Colorado test. You need 20 right to pass.
      </Text>

      <View style={styles.switch}>
        <Button
          label="Untimed"
          variant={mode === 'untimed' ? 'primary' : 'secondary'}
          selected={mode === 'untimed'}
          onPress={() => chooseMode('untimed')}
        />
        <Button
          label="Timed — 60 min, like the real test"
          variant={mode === 'timed' ? 'primary' : 'secondary'}
          selected={mode === 'timed'}
          onPress={() => chooseMode('timed')}
        />
      </View>

      {saved ? (
        <Card>
          <Text style={typography.h2}>You have a test in progress</Text>
          <Text style={[typography.body, styles.muted]}>
            {`${Object.keys(saved.answers).length} of ${saved.questions.length} answered`}
          </Text>
          {timeLeftSec !== null ? (
            <Text style={[typography.body, styles.muted]}>
              {expired ? "Time's up — open it to submit" : `${Math.ceil(timeLeftSec / 60)} min left`}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {expired ? (
              <Button label="Open to submit" onPress={() => navigation.navigate('PracticeTest', { resume: true })} />
            ) : (
              <>
                <Button label="Resume" onPress={() => navigation.navigate('PracticeTest', { resume: true })} />
                <Button label="Discard" variant="text" onPress={discard} />
              </>
            )}
          </View>
        </Card>
      ) : null}

      <Button
        label="Start a practice test"
        variant={saved ? 'secondary' : 'primary'}
        onPress={() => {
          if (uid) void startPracticeTest(navigation, uid, 'navigate');
        }}
      />
      <Text style={[typography.small, styles.muted]}>Based on the Colorado Driver Handbook.</Text>

      <MissedRow recent={recent} onPress={() => navigation.navigate('MissedQuestions')} />

      <Text style={[typography.h2, styles.sectionTitle]} accessibilityRole="header">
        Recent tests
      </Text>
      {attempts.status === 'loading' ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading your tests" />
      ) : attempts.status === 'error' || attempts.attempts.length === 0 ? (
        <Text style={[typography.body, styles.muted]}>Your tests will show here.</Text>
      ) : (
        attempts.attempts.map((attempt) => (
          <AttemptRow
            key={attempt.testId}
            attempt={attempt}
            onPress={() => navigation.navigate('PracticeResults', { testId: attempt.testId })}
          />
        ))
      )}
    </ScrollView>
  );
}

/** ph-4-us-5: hidden until there's a graded attempt; no number while the attempts load. */
function MissedRow({ recent, onPress }: { recent: ReturnType<typeof useRecentAttempts>; onPress: () => void }) {
  if (recent.status !== 'ready' || recent.attempts.length === 0) return null;
  const count = latestMisses(recent.attempts).length;
  const label = count === 0 ? 'Missed questions · none right now' : `Missed questions · ${count}`;
  return (
    <Card onPress={onPress} accessibilityLabel={label}>
      <Text style={typography.bodySemibold}>{label}</Text>
    </Card>
  );
}

function AttemptRow({ attempt, onPress }: { attempt: PracticeOutcome; onPress: () => void }) {
  const didPass = passed(attempt);
  const label = `${attemptDateLabel(attempt.createdAt)} · ${attempt.correctCount} of ${attempt.totalCount}`;
  return (
    <Card onPress={onPress} accessibilityLabel={`${label}, ${didPass ? 'Pass' : 'Not yet'}`} style={styles.rowCard}>
      <View style={styles.row}>
        <Text style={[typography.bodySemibold, styles.rowLabel]}>{label}</Text>
        <View style={[styles.chip, didPass ? styles.chipPass : styles.chipNeutral]}>
          <Text style={[typography.small, { color: didPass ? colors.success : colors.inkSoft }]}>
            {didPass ? 'Pass' : 'Not yet'}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  muted: { color: colors.inkSoft },
  switch: { gap: spacing.space2 },
  actions: { gap: spacing.space2, marginTop: spacing.space2 },
  sectionTitle: { marginTop: spacing.space4 },
  rowCard: { minHeight: 48, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space3 },
  rowLabel: { flex: 1 },
  chip: { borderRadius: radius.chip, paddingHorizontal: spacing.space3, paddingVertical: spacing.space1 },
  chipPass: { backgroundColor: colors.successSoft },
  chipNeutral: { backgroundColor: colors.line },
});
