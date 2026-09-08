import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { getApp } from '@react-native-firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

// ph-0-us-4 smoke test: confirms Firestore + Analytics are wired to the right Firebase
// project end-to-end. Dev-only; remove once ph-0-us-6/7 land real device-scoped reads/writes.
async function runFirebaseSmokeTest(): Promise<string> {
  const appEnv = Constants.expoConfig?.extra?.appEnv ?? 'unknown';
  const app = getApp();

  await logEvent(getAnalytics(app), 'smoke_test_launch', { appEnv });

  await setDoc(doc(getFirestore(app), '_smoke_test', 'ph-0-us-4'), {
    appEnv,
    checkedAt: serverTimestamp(),
  });

  return `Firebase OK (${appEnv})`;
}

export default function App() {
  const [smokeTestStatus, setSmokeTestStatus] = useState('Running Firebase smoke test...');

  useEffect(() => {
    if (!__DEV__) return;

    runFirebaseSmokeTest()
      .then(setSmokeTestStatus)
      .catch((error) => {
        // Expected to fail with permission-denied until ph-0-us-6 sets Firestore rules —
        // logged, not thrown, so a Firebase hiccup never crashes app startup.
        console.warn('[firebase smoke test]', error);
        setSmokeTestStatus(`Firebase smoke test failed: ${error.message ?? error}`);
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      {__DEV__ && <Text style={styles.debug}>{smokeTestStatus}</Text>}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debug: {
    marginTop: 12,
    fontSize: 12,
    color: '#888',
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
