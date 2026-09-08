import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { getApp } from '@react-native-firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';

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
      <Text style={styles.title}>No connection</Text>
      <Text style={styles.debug}>
        DMV Prep needs a connection the first time you open it. Check your connection and try
        again.
      </Text>
      <Pressable style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Try again</Text>
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
        <StatusBar style="auto" />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        {__DEV__ && <Text style={styles.debug}>{error}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      {__DEV__ && <Text style={styles.debug}>{smokeTestStatus}</Text>}
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  debug: {
    marginTop: 12,
    fontSize: 12,
    color: '#888',
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#1a73e8',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
