import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { getApp } from '@react-native-firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

// ph-0-us-7: signs the device in anonymously on first launch (no visible login UI), restores
// the existing session on later launches, and creates users/{uid} exactly once. Every later
// phase's Firestore reads/writes should go through `useAuth()` rather than re-deriving
// identity — see this story's Tasks for why.
type AuthStatus = 'loading' | 'ready' | 'offline' | 'error';

interface AuthState {
  status: AuthStatus;
  uid: string | null;
  error: string | null;
  retry: () => void;
}

const AuthContext = createContext<AuthState>({
  status: 'loading',
  uid: null,
  error: null,
  retry: () => {},
});

async function ensureUserDocument(uid: string): Promise<void> {
  const firestore = getFirestore(getApp());
  const userDoc = doc(firestore, 'users', uid);
  const snapshot = await getDoc(userDoc);

  if (snapshot.exists()) {
    return;
  }

  // First-ever sign-in for this install: create the users/{uid} doc and log the funnel event.
  // A read-then-write has a narrow race window (two concurrent first launches), but there's
  // only one client per device identity, so that can't happen in practice.
  await setDoc(userDoc, { createdAt: serverTimestamp() });
  await logEvent(getAnalytics(getApp()), 'first_open_signed_in' as never, {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, 'retry'>>({
    status: 'loading',
    uid: null,
    error: null,
  });
  const authRef = useRef<Auth | null>(null);

  const attemptSignIn = useCallback(async () => {
    const auth = authRef.current;
    if (!auth) return;

    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      await signInAnonymously(auth);
      // onAuthStateChanged fires with the signed-in user; state updates there.
    } catch (error: any) {
      const isOffline = error?.code === 'auth/network-request-failed';
      console.warn('[auth] signInAnonymously failed', error);
      setState({
        status: isOffline ? 'offline' : 'error',
        uid: null,
        error: error?.message ?? String(error),
      });
    }
  }, []);

  useEffect(() => {
    const auth = getAuth(getApp());
    authRef.current = auth;

    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        try {
          await ensureUserDocument(user.uid);
          setState({ status: 'ready', uid: user.uid, error: null });
        } catch (error: any) {
          console.warn('[auth] failed to ensure users/{uid} document', error);
          setState({ status: 'error', uid: user.uid, error: error?.message ?? String(error) });
        }
        return;
      }

      // No restored session: either a genuine first launch, or a previous
      // signInAnonymously() attempt got interrupted (e.g. force-quit) — attemptSignIn()
      // handles both the same way.
      void attemptSignIn();
    });

    return unsubscribe;
  }, [attemptSignIn]);

  return (
    <AuthContext.Provider value={{ ...state, retry: () => void attemptSignIn() }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
