import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';

const AuthContext = createContext(null);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

async function readTokenClaims(firebaseUser) {
  try {
    const result = await firebaseUser.getIdTokenResult();
    return result.claims || {};
  } catch {
    return {};
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [claims, setClaims] = useState({});
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async (firebaseUser, { createIfMissing = true } = {}) => {
    if (!db || !firebaseUser) return null;
    setProfileLoading(true);
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setProfile(data);
        await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true }).catch(() => {});
        return data;
      }
      if (!createIfMissing) {
        setProfile(null);
        return null;
      }
      const baseProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || '',
        photoURL: firebaseUser.photoURL || null,
        role: 'user',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      };
      await setDoc(userRef, baseProfile);
      setProfile(baseProfile);
      return baseProfile;
    } catch (error) {
      console.warn('[auth] Failed to load profile:', error?.code || error);
      setProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setClaims({});
        setLoading(false);
        return;
      }

      const [nextClaims] = await Promise.all([
        readTokenClaims(firebaseUser),
        loadProfile(firebaseUser)
      ]);
      setClaims(nextClaims);
      setLoading(false);
    });

    return unsubscribe;
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!auth?.currentUser) return null;
    const nextClaims = await readTokenClaims(auth.currentUser);
    setClaims(nextClaims);
    return loadProfile(auth.currentUser, { createIfMissing: false });
  }, [loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await loadProfile(credential.user);
    return credential.user;
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    const credential = await signInWithPopup(auth, googleProvider);
    await loadProfile(credential.user);
    return credential.user;
  }, [loadProfile]);

  const signUp = useCallback(
    async ({ displayName, email, password }) => {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName });
      await loadProfile(credential.user);
      try {
        await sendEmailVerification(credential.user);
      } catch (error) {
        console.warn('[auth] Verification email failed:', error?.code || error);
      }
      return credential.user;
    },
    [loadProfile]
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setProfile(null);
    setClaims({});
  }, []);

  const resetPassword = useCallback((email) => sendPasswordResetEmail(auth, email), []);

  const resendVerification = useCallback(async () => {
    if (!auth?.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  }, []);

  const reloadUser = useCallback(async () => {
    if (!auth?.currentUser) return null;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    setUser(refreshed);
    return refreshed;
  }, []);

  const isAdmin = profile?.role === 'admin' || claims.admin === true;

  const value = useMemo(
    () => ({
      user,
      profile,
      claims,
      loading,
      profileLoading,
      isAdmin,
      firebaseReady: isFirebaseConfigured,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      resetPassword,
      resendVerification,
      reloadUser,
      refreshProfile
    }),
    [
      user,
      profile,
      claims,
      loading,
      profileLoading,
      isAdmin,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      resetPassword,
      resendVerification,
      reloadUser,
      refreshProfile
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
