import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme/tokens';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';

// ph-0-us-8: root navigation shell. Each tab is its own stack navigator (not a single flat
// screen) so a later phase can push nested screens (e.g. a flashcard detail screen under
// Study) without restructuring this root navigator — see this story's AC4.
export type RootTabParamList = {
  Study: undefined;
  PracticeTests: undefined;
  DrivingLog: undefined;
  Progress: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

function makeStack(routeName: string, title: string, placeholderLabel: string) {
  const Stack = createNativeStackNavigator();
  function StackNavigator() {
    return (
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: {
            fontFamily: typography.h2.fontFamily,
            fontSize: typography.h2.fontSize,
            color: colors.ink,
          },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name={routeName} options={{ title }}>
          {() => <PlaceholderScreen label={placeholderLabel} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }
  return StackNavigator;
}

const StudyStack = makeStack('StudyHome', 'Study', 'Study');
const PracticeTestsStack = makeStack('PracticeTestsHome', 'Practice Tests', 'Practice Tests');
const DrivingLogStack = makeStack('DrivingLogHome', 'Driving Log', 'Driving Log');
const ProgressStack = makeStack('ProgressHome', 'Progress', 'Progress / Outcome');

const TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Study: 'book',
  PracticeTests: 'clipboard',
  DrivingLog: 'car',
  Progress: 'stats-chart',
};

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.inkFaint,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
          tabBarLabelStyle: typography.small,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_ICONS[route.name as keyof RootTabParamList]} size={size} color={color} />
          ),
        })}
      >
        <Tab.Screen
          name="Study"
          component={StudyStack}
          options={{ tabBarAccessibilityLabel: 'Study' }}
        />
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
    </NavigationContainer>
  );
}
