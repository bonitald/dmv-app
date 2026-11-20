import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { useAuth } from '../auth/AuthProvider';
import { NoConnection } from '../components/NoConnection';
import { openConcept } from '../navigation/openConcept';
import type { RootStackParamList } from '../navigation/types';
import { useTestAttempt } from '../review/useTestAttempt';
import { colors } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { fromPracticeAttempt } from './practiceData';
import { PracticeResults } from './PracticeResults';
import { startPracticeTest } from './startPracticeTest';

// ph-4-us-1: reopen a finished practice test's results from the Practice tab's recent list.

export function PracticeResultsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { testId } = useRoute<RouteProp<RootStackParamList, 'PracticeResults'>>().params;
  const { uid } = useAuth();
  const attempt = useTestAttempt(testId);
  const topics = useTopics();

  if (attempt.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading your results" />
      </View>
    );
  }
  if (attempt.status === 'error' && attempt.offline) {
    return (
      <NoConnection
        message="These results need a connection the first time they open. Check your connection and try again."
        onRetry={attempt.retry}
      />
    );
  }
  const outcome = attempt.status === 'ready' ? fromPracticeAttempt(testId, attempt.data) : null;
  if (!outcome) {
    return (
      <NoConnection
        title="Something went wrong"
        message="We couldn't load these results. Try again in a moment."
        onRetry={attempt.retry}
      />
    );
  }
  return (
    <PracticeResults
      outcome={outcome}
      topics={topics.status === 'ready' ? topics.topics : []}
      onOpenTopic={(chunkId) => openConcept(navigation, chunkId)}
      onReview={() => navigation.navigate('Review', { testId })}
      onTakeAnother={() => {
        if (uid) void startPracticeTest(navigation, uid, 'replace');
      }}
      onBack={() => navigation.goBack()}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
