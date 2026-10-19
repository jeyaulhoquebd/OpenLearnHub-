import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  getRedirectResult,
  GithubAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  OAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import i18n from '../lib/i18n';
import { isAccountExistsError, isDismissedPopup } from '../lib/authErrors';

const AuthContext = createContext(null);

/** The four sign-in methods enabled in the Firebase console. */
export const SIGN_IN_PROVIDERS = ['google', 'github', 'apple'];

function createProvider(providerId) {
  switch (providerId) {
    case 'google': {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return provider;
    }
    case 'github':
      return new GithubAuthProvider();
    case 'apple': {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      return provider;
    }
    default:
      throw new Error(`Unsupported sign-in provider: ${providerId}`);
  }
}

function providerIdOf(firebaseUser) {
  const raw = firebaseUser?.providerData?.[0]?.providerId || '';
  if (raw === 'google.com') return 'google';
  if (raw === 'github.com') return 'github';
  if (raw === 'apple.com') return 'apple';
  if (raw === 'password') return 'password';
  return raw || 'password';
}

function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function shouldFallbackToRedirect(error) {
  const code = error?.code || '';
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/cancelled-popup-request'
  );
}

function currentLanguage() {
  const lang = (i18n?.language || 'en').slice(0, 2);
  return ['en', 'bn', 'ur'].includes(lang) ? lang : 'en';
}

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
  const [pendingLink, setPendingLink] = useState(null);
  const [linkNotice, setLinkNotice] = useState(null);

  // Credential objects cannot be serialised, so the pending link for
  // account-exists-with-different-credential lives in memory for this session.
  const pendingCredentialRef = useRef(null);

  const loadProfile = useCallback(async (firebaseUser, { createIfMissing = true } = {}) => {
    if (!db || !firebaseUser) return null;
    setProfileLoading(true);
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setProfile(data);
        await setDoc(
          userRef,
          { lastLoginAt: serverTimestamp(), emailVerified: firebaseUser.emailVerified },
          { merge: true }
        ).catch(() => {});
        return data;
      }
      if (!createIfMissing) {
        setProfile(null);
        return null;
      }
      // Note: `role` is intentionally never written. Admin access is granted
      // with a Firebase custom claim (see server/scripts/set-admin.js).
      const baseProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || '',
        photoURL: firebaseUser.photoURL || null,
        provider: providerIdOf(firebaseUser),
        preferredLanguage: currentLanguage(),
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        emailVerified: firebaseUser.emailVerified
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

  const linkPendingCredential = useCallback(async (firebaseUser) => {
    const credential = pendingCredentialRef.current;
    if (!credential) return false;
    try {
      await linkWithCredential(firebaseUser, credential);
      pendingCredentialRef.current = null;
      setPendingLink(null);
      setLinkNotice({ type: 'success' });
      return true;
    } catch (error) {
      console.warn('[auth] Linking failed:', error?.code || error);
      setLinkNotice({ type: 'error' });
      return false;
    }
  }, []);

  const handleAccountConflict = useCallback(async (error) => {
    const email = error?.email || '';
    pendingCredentialRef.current = error?.credential || null;
    let methods = [];
    try {
      methods = await fetchSignInMethodsForEmail(auth, email);
    } catch {
      methods = [];
    }
    const existingProvider = methods[0] || 'password';
    setPendingLink({ email, methods, providerId: existingProvider });
    return { email, methods, providerId: existingProvider };
  }, []);

  const completeSignIn = useCallback(
    async (firebaseUser) => {
      await linkPendingCredential(firebaseUser);
      await loadProfile(firebaseUser);
      return firebaseUser;
    },
    [linkPendingCredential, loadProfile]
  );

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }

    // Completes any redirect-based sign-in started on a previous page load.
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) return loadProfile(result.user);
        return undefined;
      })
      .catch((error) => {
        if (isAccountExistsError(error)) {
          handleAccountConflict(error);
        } else if (!isDismissedPopup(error)) {
          console.warn('[auth] Redirect sign-in failed:', error?.code || error);
        }
      });

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
  }, [handleAccountConflict, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!auth?.currentUser) return null;
    const nextClaims = await readTokenClaims(auth.currentUser);
    setClaims(nextClaims);
    setUser(auth.currentUser);
    return loadProfile(auth.currentUser, { createIfMissing: false });
  }, [loadProfile]);

  const signIn = useCallback(
    async (email, password) => {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await completeSignIn(credential.user);
      return credential.user;
    },
    [completeSignIn]
  );

  const signInWithProvider = useCallback(
    async (providerId) => {
      const provider = createProvider(providerId);
      // On mobile, go straight to the redirect flow — popups are unreliable.
      if (isMobileBrowser()) {
        await signInWithRedirect(auth, provider);
        return null;
      }
      try {
        const credential = await signInWithPopup(auth, provider);
        await completeSignIn(credential.user);
        return credential.user;
      } catch (error) {
        if (isAccountExistsError(error)) {
          await handleAccountConflict(error);
          throw error;
        }
        if (shouldFallbackToRedirect(error)) {
          await signInWithRedirect(auth, provider);
          return null;
        }
        throw error;
      }
    },
    [completeSignIn, handleAccountConflict]
  );

  const signUp = useCallback(
    async ({ displayName, email, password }) => {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(credential.user, { displayName });
      }
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
    pendingCredentialRef.current = null;
    setPendingLink(null);
    setLinkNotice(null);
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
    if (refreshed.emailVerified && db) {
      setDoc(doc(db, 'users', refreshed.uid), { emailVerified: true }, { merge: true }).catch(() => {});
    }
    return refreshed;
  }, []);

  const updatePreferredLanguage = useCallback(
    async (language) => {
      if (!auth?.currentUser || !db) return;
      setProfile((current) => (current ? { ...current, preferredLanguage: language } : current));
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        { preferredLanguage: language },
        { merge: true }
      ).catch(() => {});
    },
    []
  );

  const deleteAccount = useCallback(async () => {
    if (!auth?.currentUser) return;
    const current = auth.currentUser;
    // Remove the profile first: once the auth user is gone the client can no
    // longer satisfy the security rules.
    if (db) {
      await deleteDoc(doc(db, 'users', current.uid)).catch(() => {});
    }
    await deleteUser(current);
    pendingCredentialRef.current = null;
    setPendingLink(null);
    setProfile(null);
    setClaims({});
  }, []);

  const clearLinkNotice = useCallback(() => setLinkNotice(null), []);
  const clearPendingLink = useCallback(() => {
    pendingCredentialRef.current = null;
    setPendingLink(null);
  }, []);

  const provider = providerIdOf(user);
  // Social providers only ever return verified addresses.
  const isVerified = Boolean(user && (user.emailVerified || provider !== 'password'));
  const isAdmin = claims.admin === true;

  const value = useMemo(
    () => ({
      user,
      profile,
      claims,
      loading,
      profileLoading,
      isAdmin,
      isVerified,
      provider,
      pendingLink,
      linkNotice,
      firebaseReady: isFirebaseConfigured,
      signIn,
      signUp,
      signInWithProvider,
      signOut,
      resetPassword,
      resendVerification,
      reloadUser,
      refreshProfile,
      updatePreferredLanguage,
      deleteAccount,
      clearLinkNotice,
      clearPendingLink
    }),
    [
      user,
      profile,
      claims,
      loading,
      profileLoading,
      isAdmin,
      isVerified,
      provider,
      pendingLink,
      linkNotice,
      signIn,
      signUp,
      signInWithProvider,
      signOut,
      resetPassword,
      resendVerification,
      reloadUser,
      refreshProfile,
      updatePreferredLanguage,
      deleteAccount,
      clearLinkNotice,
      clearPendingLink
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
