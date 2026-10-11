import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingChoice } from '../profile/profileData';
import type { PassMode } from '../study/deckOrder';

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
  /** The baseline flow (ph-3-us-13). */
  Baseline: undefined;
  /** Question-by-question review of a graded attempt (ph-4-us-4). */
  Review: { testId: string };
  /** One topic's flip-card flashcards (ph-2-us-3). Above the tabs so Back returns to the list,
   * results or review, wherever it was opened from. A new `pass` (Review Again, Slice 4b)
   * starts that pass in the open viewer. */
  Flashcards: { chunkId: string; pass?: { mode: PassMode; nonce: number } };
  /** The topic's mini-quiz (ph-2-us-8). */
  MiniQuiz: { chunkId: string };
  TestDateEditor: undefined;
};

export type HomeStackParamList = {
  HomeScreen: undefined;
  Settings: undefined;
};

export type StudyStackParamList = {
  /** The concept list (ph-2-us-7). Flashcards open above the tabs, on the root stack. */
  StudyHome: undefined;
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
