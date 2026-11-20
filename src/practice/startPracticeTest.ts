import { Alert } from 'react-native';
import { StackActions, type NavigationProp } from '@react-navigation/native';
import { endSession, getActiveSession } from '../quiz/quizSession';
import type { RootStackParamList } from '../navigation/types';

// ph-3-us-4: every way into a fresh practice test goes through here. One test can be saved on
// the phone at a time, so starting a new one while another is saved asks before discarding it.
// `replace` is for "Take another test" from the results, so Back doesn't return to them.

export async function startPracticeTest(
  navigation: NavigationProp<RootStackParamList>,
  uid: string,
  mode: 'navigate' | 'replace'
): Promise<void> {
  const go = () => {
    if (mode === 'replace') navigation.dispatch(StackActions.replace('PracticeTest', undefined));
    else navigation.navigate('PracticeTest', undefined);
  };
  const saved = await getActiveSession(uid, 'practice');
  if (!saved) {
    go();
    return;
  }
  Alert.alert('Start a new test?', 'Your unfinished test will be discarded.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Start new',
      onPress: () => {
        void endSession(uid, 'practice', saved.testId).then(go);
      },
    },
  ]);
}
