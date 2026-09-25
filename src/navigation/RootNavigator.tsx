import { Pressable } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme/tokens';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { BaselineScreen } from '../baseline/BaselineScreen';
import { HomeScreen } from '../home/HomeScreen';
import { SettingsScreen } from '../settings/SettingsScreen';
import { WelcomeScreen } from '../onboarding/WelcomeScreen';
import { ChoiceScreen } from '../onboarding/ChoiceScreen';
import { OnboardingTestDateScreen } from '../onboarding/OnboardingTestDateScreen';
import type { InitialRoute } from '../onboarding/onboardingGate';
import { TestDateEditorScreen } from '../profile/TestDateEditorScreen';
import type { HomeStackParamList, RootStackParamList, RootTabParamList } from './types';

export type { RootTabParamList } from './types';

// ph-0-us-8 / ph-9-us-3 / ph-9-us-7: a root stack holds onboarding, then `Main` (the tabs), plus
// full-screen flows above the tabs (Baseline, the test date editor). Each tab is its own stack
// so later slices can push nested screens without restructuring this file.

const headerOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: {
    fontFamily: typography.h2.fontFamily,
    fontSize: typography.h2.fontSize,
    color: colors.ink,
  },
  headerTintColor: colors.ink,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const HomeStackNav = createNativeStackNavigator<HomeStackParamList>();

function HomeStack() {
  return (
    <HomeStackNav.Navigator screenOptions={headerOptions}>
      <HomeStackNav.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'Home',
          headerRight: () => (
            <Pressable
              onPress={() => navigation.navigate('Settings')}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={12}
            >
              <Ionicons name="settings-outline" size={22} color={colors.ink} />
            </Pressable>
          ),
        })}
      />
      <HomeStackNav.Screen name="Settings" component={SettingsScreen} />
    </HomeStackNav.Navigator>
  );
}

function makeStack(routeName: string, title: string, placeholderLabel: string, note?: string) {
  const Stack = createNativeStackNavigator();
  function StackNavigator() {
    return (
      <Stack.Navigator screenOptions={headerOptions}>
        <Stack.Screen name={routeName} options={{ title }}>
          {() => <PlaceholderScreen label={placeholderLabel} note={note} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }
  return StackNavigator;
}

// The Study tab's first screen becomes the concept list (ph-2-us-7, Slice 4).
const StudyStack = makeStack('StudyHome', 'Study', 'Concepts');
const PracticeTestsStack = makeStack(
  'PracticeTestsHome',
  'Practice Tests',
  'Practice Tests',
  'Based on the Colorado Driver Handbook.'
);
const DrivingLogStack = makeStack('DrivingLogHome', 'Driving Log', 'Driving Log');
const ProgressStack = makeStack('ProgressHome', 'Progress', 'Progress / Outcome');

const TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Study: 'book',
  PracticeTests: 'clipboard',
  DrivingLog: 'car',
  Progress: 'stats-chart',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: typography.small,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} options={{ tabBarAccessibilityLabel: 'Home' }} />
      <Tab.Screen name="Study" component={StudyStack} options={{ tabBarAccessibilityLabel: 'Study' }} />
      <Tab.Screen
        name="PracticeTests"
        component={PracticeTestsStack}
        options={{ tabBarLabel: 'Practice', tabBarAccessibilityLabel: 'Practice Tests' }}
      />
      <Tab.Screen
        name="DrivingLog"
        component={DrivingLogStack}
        options={{ tabBarLabel: 'Driving Log', tabBarAccessibilityLabel: 'Driving Log' }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressStack}
        options={{ tabBarAccessibilityLabel: 'Progress and Outcome' }}
      />
    </Tab.Navigator>
  );
}

/** `initialRoute` comes from the onboarding gate and is only read on first mount. */
export function RootNavigator({ initialRoute }: { initialRoute: InitialRoute }) {
  return (
    <NavigationContainer>
      <RootStack.Navigator initialRouteName={initialRoute} screenOptions={headerOptions}>
        <RootStack.Group screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Welcome" component={WelcomeScreen} />
          <RootStack.Screen name="Main" component={MainTabs} />
        </RootStack.Group>
        <RootStack.Screen name="Choice" component={ChoiceScreen} options={{ title: '' }} />
        <RootStack.Screen
          name="OnboardingTestDate"
          component={OnboardingTestDateScreen}
          options={{ title: '' }}
        />
        <RootStack.Screen
          name="Baseline"
          component={BaselineScreen}
          options={{ title: 'Baseline' }}
        />
        <RootStack.Screen
          name="TestDateEditor"
          component={TestDateEditorScreen}
          options={{ title: 'Test date' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
