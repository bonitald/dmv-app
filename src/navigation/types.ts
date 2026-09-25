import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingChoice } from '../profile/profileData';

// ph-0-us-8 / ph-9-us-3 / ph-9-us-7: route params for the whole app, in one place so every
// screen's `navigation` is typed.

export type RootTabParamList = {
  Home: undefined;
  Study: undefined;
  PracticeTests: undefined;
  DrivingLog: undefined;
  Progress: undefined;
};

/**
 * The root stack: onboarding steps, then `Main` (the tabs), plus full-screen flows that sit
 * above the tabs so Back returns to wherever the user came from.
 */
export type RootStackParamList = {
  Welcome: undefined;
  Choice: undefined;
  OnboardingTestDate: { choice: OnboardingChoice };
  Main: NavigatorScreenParams<RootTabParamList> | undefined;
  /** The baseline flow. A placeholder until ph-3-us-13 (Slice 2). */
  Baseline: undefined;
  TestDateEditor: undefined;
};

export type HomeStackParamList = {
  HomeScreen: undefined;
  Settings: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

declare global {
  namespace ReactNavigation {
    // Lets useNavigation() anywhere navigate to root routes without extra typing.
    interface RootParamList extends RootStackParamList {}
  }
}
