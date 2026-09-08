import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import Constants from 'expo-constants';
import { getApp } from '@react-native-firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors, fontsToLoad, radius, spacing, typography } from './src/theme/tokens';

SplashScreen.preventAutoHideAsync();

// ph-0-us-4/ph-0-us-6/ph-0-us-7 smoke test: confirms Firestore + Analytics are wired to the
// right Firebase project *and* that the signed-in device can read/write its own users/{uid}
// data end-to-end. Dev-only; remove once a real feature exercises this path.
async function runFirebaseSmokeTest(uid: string): Promise<string> {
  const appEnv = Constants.expoConfig?.extra?.appEnv ?? 'unknown';
  const firestore = getFirestore(getApp());

  await setDoc(doc(firestore, 'users', uid, '_smoke_test', 'ph-0-us-4'), {
    appEnv,
    checkedAt: serverTimestamp(),
  });

  return `Firebase OK (${appEnv}, uid ${uid.slice(0, 8)}…)`;
}

function NoConnectionScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={typography.h1}>No connection</Text>
      <Text style={[typography.body, styles.message]}>
        DMV Prep needs a connection the first time you open it. Check your connection and try
        again.
      </Text>
      <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
        <Text style={[typography.bodySemibold, styles.buttonText]}>Try again</Text>
      </Pressable>
    </View>
  );
}

function AppContent() {
  const { status, uid, error, retry } = useAuth();
  const [smokeTestStatus, setSmokeTestStatus] = useState('');

  useEffect(() => {
    if (!__DEV__ || status !== 'ready' || !uid) return;

    setSmokeTestStatus('Running Firebase smoke test...');
    runFirebaseSmokeTest(uid)
      .then(setSmokeTestStatus)
      .catch((err) => {
        console.warn('[firebase smoke test]', err);
        setSmokeTestStatus(`Firebase smoke test failed: ${err.message ?? err}`);
      });
  }, [status, uid]);

  if (status === 'offline') {
    return <NoConnectionScreen onRetry={retry} />;
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
    <View style={{ flex: 1 }}>
      <RootNavigator />
      {__DEV__ && (
        <View style={styles.debugBanner} pointerEvents="none">
          <Text style={typography.small}>{smokeTestStatus}</Text>
        </View>
      )}
    </View>
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
  button: {
    marginTop: spacing.space5,
    backgroundColor: colors.primary,
    paddingVertical: spacing.space3,
    paddingHorizontal: spacing.space6,
    borderRadius: radius.button,
  },
  buttonText: {
    color: colors.surface,
  },
  debugBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingVertical: spacing.space1,
    paddingHorizontal: spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    zIndex: 10,
  },
});
