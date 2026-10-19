/**
 * Maps Firebase Auth error codes to i18n keys so every failure mode has a
 * friendly, translated message. Render with `t(authErrorKey(error))`.
 */
const AUTH_ERROR_KEYS = {
  'auth/invalid-email': 'auth.invalidEmail',
  'auth/missing-email': 'auth.invalidEmail',
  'auth/user-disabled': 'auth.accountDisabled',
  'auth/user-not-found': 'auth.userNotFound',
  'auth/wrong-password': 'auth.wrongPassword',
  'auth/invalid-credential': 'auth.wrongPassword',
  'auth/invalid-login-credentials': 'auth.wrongPassword',
  'auth/email-already-in-use': 'auth.emailInUse',
  'auth/credential-already-in-use': 'auth.emailInUse',
  'auth/weak-password': 'auth.weakPassword',
  'auth/popup-closed-by-user': 'auth.popupClosed',
  'auth/cancelled-popup-request': 'auth.popupClosed',
  'auth/popup-blocked': 'auth.popupBlocked',
  'auth/too-many-requests': 'auth.tooManyRequests',
  'auth/network-request-failed': 'auth.networkError',
  'auth/operation-not-allowed': 'auth.operationNotAllowed',
  'auth/requires-recent-login': 'auth.requiresRecentLogin',
  'auth/account-exists-with-different-credential': 'auth.accountExistsDifferent',
  'auth/provider-already-linked': 'auth.genericError',
  'auth/unauthorized-domain': 'auth.genericError',
  'auth/web-storage-unsupported': 'auth.genericError',
  'auth/internal-error': 'auth.genericError'
};

/** Firebase providerId → i18n key for the human-readable provider name. */
const PROVIDER_LABEL_KEYS = {
  'google.com': 'auth.providerGoogle',
  'github.com': 'auth.providerGithub',
  'apple.com': 'auth.providerApple',
  password: 'auth.providerPassword'
};

/** Firebase sign-in method → the app's short provider id. */
const METHOD_TO_PROVIDER = {
  'google.com': 'google',
  'github.com': 'github',
  'apple.com': 'apple',
  password: 'password'
};

export function authErrorKey(error) {
  const code = error?.code || '';
  return AUTH_ERROR_KEYS[code] || 'auth.genericError';
}

export function providerLabelKey(providerId) {
  return PROVIDER_LABEL_KEYS[providerId] || 'auth.providerPassword';
}

export function providerIdFromMethod(method) {
  return METHOD_TO_PROVIDER[method] || null;
}

/** Popup closings are user-initiated — show no error banner for them. */
export function isDismissedPopup(error) {
  const code = error?.code || '';
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
}

export function isAccountExistsError(error) {
  return (error?.code || '') === 'auth/account-exists-with-different-credential';
}
