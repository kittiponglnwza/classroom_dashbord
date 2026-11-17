const CONSENT_COOKIE_NAME = 'classroom_hub_consent';
const CONSENT_STORAGE_KEY = 'classroom_hub_cookie_consent';
const CONSENT_VERSION = 1;
const CONSENT_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 365 days

/**
 * Builds RFC 6265 compliant cookie attribute string for client-managed consent cookie.
 * Note: HttpOnly is a server-only response header flag and cannot be set via document.cookie
 * in a pure SPA architecture without a backend server.
 */
export function buildConsentCookieAttributes(maxAgeSeconds = CONSENT_MAX_AGE_SECONDS, protocol = typeof window !== 'undefined' ? window.location?.protocol : 'http:') {
  const expiresDate = new Date(Date.now() + maxAgeSeconds * 1000).toUTCString();
  const parts = [
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    `Expires=${expiresDate}`,
    'SameSite=Lax'
  ];
  if (protocol === 'https:') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function readConsentFromCookie() {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const rawValue = decodeURIComponent(match.slice(CONSENT_COOKIE_NAME.length + 1));
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function readConsentFromStorage() {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isValidConsentRecord(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.version !== CONSENT_VERSION) return false;
  if (record.necessary !== true) return false;
  if (typeof record.preferences !== 'boolean' || typeof record.analytics !== 'boolean') return false;
  if (typeof record.expiresAt !== 'number' || Date.now() >= record.expiresAt) return false;
  return true;
}

function writeConsentCookie(record) {
  if (typeof document === 'undefined') return;
  const remainingSeconds = Math.max(1, Math.floor((record.expiresAt - Date.now()) / 1000));
  const attrs = buildConsentCookieAttributes(remainingSeconds);
  const encoded = encodeURIComponent(JSON.stringify(record));
  document.cookie = `${CONSENT_COOKIE_NAME}=${encoded}; ${attrs}`;
}

function writeConsentStorage(record) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage quota errors; cookie still persists consent.
  }
}

/**
 * Removes any non-essential first-party cookies when the user rejects optional cookies.
 */
export function purgeOptionalCookies() {
  if (typeof document === 'undefined' || !document.cookie) return;
  const cookies = document.cookie.split('; ');
  cookies.forEach(entry => {
    const eqIdx = entry.indexOf('=');
    const name = (eqIdx >= 0 ? entry.slice(0, eqIdx) : entry).trim();
    if (!name || name === CONSENT_COOKIE_NAME) return;
    document.cookie = `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  });
}

/**
 * Reads persisted cookie consent from first-party cookie or localStorage fallback.
 * Re-synchronizes both stores if one was cleared while the other remains valid.
 */
export function getCookieConsent() {
  const fromCookie = readConsentFromCookie();
  const fromStorage = readConsentFromStorage();

  const cookieValid = isValidConsentRecord(fromCookie);
  const storageValid = isValidConsentRecord(fromStorage);

  if (cookieValid && storageValid) {
    return fromCookie;
  }
  if (cookieValid && !storageValid) {
    writeConsentStorage(fromCookie);
    return fromCookie;
  }
  if (!cookieValid && storageValid) {
    writeConsentCookie(fromStorage);
    return fromStorage;
  }

  // Clean up any expired or corrupted entries
  if (fromCookie || fromStorage) {
    clearCookieConsent();
  }
  return null;
}

/**
 * Persists the user's cookie consent choice across refreshes and browser restarts.
 */
export function saveCookieConsent({ preferences = true, analytics = false, status = 'custom' } = {}) {
  const now = Date.now();
  const record = {
    version: CONSENT_VERSION,
    necessary: true,
    preferences: Boolean(preferences),
    analytics: Boolean(analytics),
    status,
    updatedAt: new Date(now).toISOString(),
    expiresAt: now + CONSENT_MAX_AGE_SECONDS * 1000
  };

  writeConsentCookie(record);
  writeConsentStorage(record);

  if (!record.analytics) {
    purgeOptionalCookies();
  }
  if (!record.preferences && typeof localStorage !== 'undefined') {
    localStorage.removeItem('classroom_hub_language');
    localStorage.removeItem('hide_welcome_banner');
  }

  return record;
}

export function clearCookieConsent() {
  if (typeof document !== 'undefined') {
    document.cookie = `${CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
  }
}

export const COOKIE_CONSENT_CONSTANTS = {
  CONSENT_COOKIE_NAME,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  CONSENT_MAX_AGE_SECONDS
};
