const AUTH_ERROR_KEYS = {
  'auth/invalid-email': 'auth.invalidEmail',
  'auth/user-disabled': 'auth.genericError',
  'auth/user-not-found': 'auth.wrongPassword',
  'auth/wrong-password': 'auth.wrongPassword',
  'auth/invalid-credential': 'auth.wrongPassword',
  'auth/invalid-login-credentials': 'auth.wrongPassword',
  'auth/email-already-in-use': 'auth.emailInUse',
  'auth/weak-password': 'auth.weakPassword',
  'auth/popup-closed-by-user': 'auth.popupClosed',
  'auth/cancelled-popup-request': 'auth.popupClosed',
  'auth/popup-blocked': 'auth.popupBlocked',
  'auth/too-many-requests': 'auth.genericError',
  'auth/network-request-failed': 'auth.genericError',
  'auth/operation-not-allowed': 'auth.genericError',
  'auth/requires-recent-login': 'auth.genericError'
};

export function authErrorKey(error) {
  const code = error?.code || '';
  return AUTH_ERROR_KEYS[code] || 'auth.genericError';
}
