import { Alert } from 'react-native';
import { StackActions, type NavigationProp } from '@react-navigation/native';
import { getPracticeMode } from '../profile/localFlags';
import { endSession, getActiveSession } from '../quiz/quizSession';
import type { RootStackParamList } from '../navigation/types';
import { isExpired } from './timing';

// ph-3-us-4: every way into a fresh practice test goes through here. One test can be saved on
// the phone at a time, so starting a new one while another is saved asks before discarding it.
// `replace` is for "Take another test" from the results, so Back doesn't return to them.
//
// ph-3-us-9: a timed test whose time has run out is never discarded. Opening it submits it, so
// "start a new test" opens that one instead, with no prompt.

export async function startPracticeTest(
  navigation: NavigationProp<RootStackParamList>,
  uid: string,
  mode: 'navigate' | 'replace'
): Promise<void> {
  const go = (params: RootStackParamList['PracticeTest']) => {
    if (mode === 'replace') navigation.dispatch(StackActions.replace('PracticeTest', params));
    else navigation.navigate('PracticeTest', params);
  };
  const saved = await getActiveSession(uid, 'practice');
  if (saved && isExpired(saved.timing, Date.now())) {
    go({ resume: true });
    return;
  }
  const goFresh = async () => go({ timed: (await getPracticeMode(uid)) === 'timed' });
  if (!saved) {
    await goFresh();
    return;
  }
  Alert.alert('Start a new test?', 'Your unfinished test will be discarded.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Start new',
      onPress: () => {
        // The prompt may have sat open past the deadline: re-read, and open an expired test
        // instead of deleting it.
        void getActiveSession(uid, 'practice').then((current) => {
          if (current && isExpired(current.timing, Date.now())) {
            go({ resume: true });
            return;
          }
          return endSession(uid, 'practice', saved.testId).then(goFresh);
        });
      },
    },
  ]);
}
