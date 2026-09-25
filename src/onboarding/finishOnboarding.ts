import { getApp } from '@react-native-firebase/app';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { CommonActions, type NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { saveOnboarding } from '../profile/profile';
import type { OnboardingChoice } from '../profile/profileData';
import { ONBOARDING_DONE, setLocalFlag } from '../profile/localFlags';
import type { DateString } from '../profile/testDate';

/**
 * ph-9-us-3: saves the choice (and optional test date), marks onboarding done on this device,
 * and lands the user in their route with the tabs underneath, so Back reaches Home.
 *
 * The Firestore write isn't awaited: offline it only resolves once it syncs, and the user
 * shouldn't wait for that. The local flag stops onboarding repeating either way.
 */
export async function finishOnboarding(
  navigation: NavigationProp<RootStackParamList>,
  uid: string,
  choice: OnboardingChoice,
  testDate: DateString | null
): Promise<void> {
  saveOnboarding(uid, choice, testDate).catch((error) =>
    console.warn('[onboarding] profile save failed', error)
  );
  await setLocalFlag(ONBOARDING_DONE, uid);
  // For insight only, not a success metric (prd.md Section 2).
  try {
    logEvent(getAnalytics(getApp()), 'onboarding_complete', {
      choice,
      test_date_set: testDate !== null,
    });
  } catch (error) {
    console.warn('[onboarding] analytics failed', error);
  }

  navigation.dispatch(
    CommonActions.reset(
      choice === 'baseline'
        ? { index: 1, routes: [{ name: 'Main' }, { name: 'Baseline' }] }
        : { index: 0, routes: [{ name: 'Main', params: { screen: 'Study' } }] }
    )
  );
}
