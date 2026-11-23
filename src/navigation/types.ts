import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingChoice } from '../profile/profileData';

// ph-0-us-8 / ph-9-us-3 / ph-9-us-7: route params for the whole app, in one place so every
// screen's `navigation` is typed.

export type RootTabParamList = {
  Home: undefined;
  Study: NavigatorScreenParams<StudyStackParamList> | undefined;
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
  /** `questionId`: show just that question (the missed questions list, ph-4-us-5). */
  Review: { testId: string; questionId?: string };
  /** ph-4-us-5: every question whose latest result was a miss. */
  MissedQuestions: undefined;
  /** One topic's flip-card flashcards (ph-2-us-3). Above the tabs so Back returns to the list,
   * results or review, wherever it was opened from. */
  Flashcards: { chunkId: string };
  /** The topic's mini-quiz (ph-2-us-8). */
  MiniQuiz: { chunkId: string };
  /** A 25-question practice test; `resume` continues the one saved on the phone (ph-3-us-4),
   * `timed` starts a new one against the 60-minute clock (ph-3-us-9). */
  PracticeTest: { resume?: boolean; timed?: boolean } | undefined;
  /** A finished practice test's results (screen added with the Practice tab). */
  PracticeResults: { testId: string };
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
