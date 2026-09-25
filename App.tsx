import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ProfileProvider, useProfile } from './src/profile/ProfileProvider';
import { getLocalFlag, ONBOARDING_DONE, setLocalFlag } from './src/profile/localFlags';
import { resolveInitialRoute, type InitialRoute } from './src/onboarding/onboardingGate';
import { NoConnection } from './src/components/NoConnection';
import { colors, fontsToLoad, spacing, typography } from './src/theme/tokens';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { status, uid, error, retry } = useAuth();

  if (status === 'offline') {
    return (
      <NoConnection
        message="DMV Prep needs a connection the first time you open it. Check your connection and try again."
        onRetry={retry}
      />
    );
  }

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Text style={typography.h1}>Something went wrong</Text>
        {__DEV__ && <Text style={[typography.small, styles.message]}>{error}</Text>}
      </View>
    );
  }

  return (
    <ProfileProvider uid={uid!}>
      <OnboardingGate uid={uid!} />
    </ProfileProvider>
  );
}

// ph-9-us-3: opens onboarding for a new user and the tabs for a returning one. The first
// decision is latched: the navigator reads its initial route once, and finishing onboarding
// moves on by resetting navigation, not by re-rendering this gate.
function OnboardingGate({ uid }: { uid: string }) {
  const { status, profile } = useProfile();
  const [localFlag, setLocalFlagState] = useState<boolean | null>(null);
  const [initialRoute, setInitialRoute] = useState<InitialRoute | null>(null);

  useEffect(() => {
    getLocalFlag(ONBOARDING_DONE, uid).then(setLocalFlagState);
  }, [uid]);

  useEffect(() => {
    if (initialRoute) return;
    const route = resolveInitialRoute(localFlag, status, profile);
    if (!route) return;
    // Onboarding done on the profile but not flagged here (e.g. local data was cleared):
    // set the flag so the next launch skips the wait.
    if (route === 'Main' && !localFlag) void setLocalFlag(ONBOARDING_DONE, uid);
    setInitialRoute(route);
  }, [initialRoute, localFlag, status, profile, uid]);

  if (!initialRoute) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <RootNavigator initialRoute={initialRoute} />
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontsError] = useFonts(fontsToLoad);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontsError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontsError]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded && !fontsError) {
    return null;
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.space5,
    gap: spacing.space2,
  },
  message: {
    textAlign: 'center',
    color: colors.inkSoft,
  },
});
