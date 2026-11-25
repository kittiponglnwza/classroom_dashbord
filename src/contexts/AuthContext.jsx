/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  getToken, saveToken, clearToken, getActiveEmail, setActiveEmail, 
  getProfile, saveProfile, getRememberMe, setRememberMe, clearAcademicLocalData, resetDatabase
} from '../utils/storage';
import { initGoogleClient } from '../services/googleClassroomClient';
import { StorageRepository } from '../repositories/StorageRepository';
import { STORAGE_CONFIG } from '../config/storage';
import { syncManager } from '../services/SyncManager';
import { calendarSyncManager } from '../services/CalendarSyncManager';
import { httpClient } from '../utils/httpClient';
import { logger } from '../utils/logger';

const SILENT_REFRESH_TIMEOUT_MS = 30 * 1000;

const hydrateProfileStudentId = (rawProfile, email) => {
  const safe = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
  const withEmail = email && !safe.email ? { ...safe, email } : safe;
  const existingId = withEmail.studentId === 'Google Sync User' ? '' : String(withEmail.studentId || '').trim();
  if (existingId) return withEmail;
  const derived = String(email || withEmail.email || '').match(/\d{13}/)?.[0] || '';
  return derived ? { ...withEmail, studentId: derived } : withEmail;
};

const buildRememberedAccount = (email) => {
  const stored = getProfile(email) || {};
  return { email, name: stored.name || '', picture: stored.avatarUrl || stored.picture || '' };
};

/**
 * @typedef {Object} AuthContextType
 * @property {string|null} accessToken
 * @property {boolean} isLoggedIn
 * @property {import('../types/models').UserProfile} profile
 * @property {{email: string, name: string, picture: string}|null} rememberedAccount
 * @property {(options?: {selectAccount?: boolean}) => void} login
 * @property {() => void} logout
 * @property {() => void} expireSession
 * @property {(profile: Partial<import('../types/models').UserProfile>) => void} handleProfileSave
 * @property {(profile: import('../types/models').UserProfile) => string} updateProfileFromGoogle
 * @property {(lang: string, onTokenSuccess?: (token: string) => void) => () => void} initClient
 * @property {() => Promise<string>} handleSilentRefresh
 */

/** @type {React.Context<AuthContextType | null>} */
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState({});
  const [tokenClient, setTokenClient] = useState(null);
  // Account remembered across browser restarts (localStorage) so a returning user can resume
  // with one click and no account chooser. Cleared only by an explicit logout.
  const [rememberedAccount, setRememberedAccount] = useState(null);
  const [rememberMe, setRememberMeState] = useState(() => getRememberMe());
  const [authError, setAuthError] = useState(null);
  const pendingTokenRequestRef = useRef(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const handleRememberMeChange = useCallback((enabled) => {
    const next = Boolean(enabled);
    setRememberMe(next);
    setRememberMeState(next);
    if (!next) {
      setRememberedAccount(null);
      if (!isLoggedIn) setProfile({});
    } else {
      const email = getActiveEmail();
      if (email) {
        setRememberedAccount(buildRememberedAccount(email));
        setProfile(hydrateProfileStudentId(getProfile(email), email));
      }
    }
  }, [isLoggedIn]);

  const settlePendingRequest = useCallback((error, token) => {
    const pending = pendingTokenRequestRef.current;
    if (!pending) return false;
    pendingTokenRequestRef.current = null;
    clearTimeout(pending.timeoutId);
    if (error) pending.reject(error);
    else pending.resolve(token);
    return true;
  }, []);

  const handleSilentRefresh = useCallback(() => {
    if (pendingTokenRequestRef.current) {
      return pendingTokenRequestRef.current.promise;
    }
    if (!tokenClient) {
      return Promise.reject(new Error('Google Token Client is not initialized yet.'));
    }

    let resolveFn;
    let rejectFn;
    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    const timeoutId = setTimeout(() => {
      logger.warn('[Auth] Silent token refresh timed out.');
      settlePendingRequest(new Error('Silent OAuth refresh timed out.'));
    }, SILENT_REFRESH_TIMEOUT_MS);
    pendingTokenRequestRef.current = { promise, resolve: resolveFn, reject: rejectFn, timeoutId };

    try {
      const hint = getActiveEmail();
      tokenClient.requestAccessToken(hint ? { prompt: 'none', login_hint: hint } : { prompt: 'none' });
    } catch (err) {
      settlePendingRequest(err);
    }
    return promise;
  }, [tokenClient, settlePendingRequest]);

  const clearSessionState = useCallback(() => {
    syncManager.cancel();
    calendarSyncManager.cancel();
    clearToken();
    setAccessToken(null);
    setIsLoggedIn(false);
    setProfile({});
    StorageRepository.clearMemoryCache();
  }, []);

  // Session expired / could not be refreshed: drop the token but keep the remembered account
  // and cached profile so the user stays in Cached Mode when Remember Me is enabled.
  const expireSession = useCallback(() => {
    clearSessionState();
    if (getRememberMe()) {
      const email = getActiveEmail();
      if (email) {
        setRememberedAccount(buildRememberedAccount(email));
        setProfile(hydrateProfileStudentId(getProfile(email), email));
      } else {
        setRememberedAccount(null);
      }
    } else {
      setActiveEmail('');
      setRememberedAccount(null);
    }
  }, [clearSessionState]);

  // Explicit user logout: revoke OAuth token with Google, forget the account on this device,
  // and scrub all user-scoped local caches (restored via Drive appDataFolder on next login).
  const handleForceLogout = useCallback(() => {
    const previousEmail = getActiveEmail();
    const tokenToRevoke = accessToken || getToken();
    if (tokenToRevoke && typeof window !== 'undefined' && typeof window.google?.accounts?.oauth2?.revoke === 'function') {
      try {
        window.google.accounts.oauth2.revoke(tokenToRevoke, () => {
          logger.info('[Auth] Google OAuth token revoked.');
        });
      } catch (err) {
        logger.warn('[Auth] Failed to revoke Google OAuth token:', err);
      }
    }
    clearSessionState();
    if (previousEmail) {
      clearAcademicLocalData(previousEmail);
      resetDatabase(previousEmail);
    }
    setAuthError(null);
    setActiveEmail('');
    setRememberedAccount(null);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('lastExamSearch');
    }
  }, [accessToken, clearSessionState]);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_CONFIG.keys.activeEmail && !e.newValue) {
        clearSessionState();
        setRememberedAccount(null);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [clearSessionState]);

  useEffect(() => {
    httpClient.registerCallbacks(
      async () => {
        logger.info('[Auth] Interceptor triggered silent refresh.');
        return await handleSilentRefresh();
      },
      () => {
        logger.warn('[Auth] Interceptor could not refresh the session; marking it expired.');
        expireSession();
      }
    );
  }, [handleSilentRefresh, expireSession]);

  useEffect(() => {
    const sessionToken = getToken(); // null when missing or expired
    const activeEmail = getActiveEmail();
    if (sessionToken && activeEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccessToken(sessionToken);
      setIsLoggedIn(true);
      setProfile(hydrateProfileStudentId(getProfile(activeEmail), activeEmail));
    } else {
      clearToken();
      setIsLoggedIn(false);
      setAccessToken(null);
      if (getRememberMe() && activeEmail) {
        setRememberedAccount(buildRememberedAccount(activeEmail));
        setProfile(hydrateProfileStudentId(getProfile(activeEmail), activeEmail));
      } else {
        setRememberedAccount(null);
      }
    }
  }, []);

  const initClient = useCallback((lang, onTokenSuccess) => {
    const checkGisLoaded = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(checkGisLoaded);
        const client = initGoogleClient(
          (tokenResponse) => {
            const token = tokenResponse.access_token;
            setAuthError(null);
            setAccessToken(token);
            saveToken(token, tokenResponse.expires_in);
            setIsLoggedIn(true);
            if (settlePendingRequest(null, token)) {
              logger.info('[Auth] Silent token refresh succeeded.');
            }
            if (onTokenSuccess) onTokenSuccess(token);
          },
          (err) => {
            const code = err?.error || err?.type || 'unknown';
            const error = new Error(`OAuth error: ${code}`);
            if (settlePendingRequest(error)) {
              logger.error('[Auth] Silent token refresh failed:', code);
            } else {
              logger.error('Google authorization failed:', err);
              if (code !== 'popup_closed') {
                setAuthError(error.message);
              }
            }
          }
        );
        if (!client) {
          setAuthError('Google OAuth Client ID is not configured.');
        }
        setTokenClient(client);
      }
    }, 400);
    return () => clearInterval(checkGisLoaded);
  }, [settlePendingRequest]);

  const login = useCallback((options) => {
    if (!tokenClient) {
      logger.error('Google OAuth client not initialized.');
      setAuthError('Google Sign-In is still loading or not configured. Please try again in a moment.');
      return;
    }
    setAuthError(null);
    if (pendingTokenRequestRef.current) {
      settlePendingRequest(new Error('Superseded by interactive sign-in'));
    }
    const selectAccount = typeof options === 'object' && options !== null && options.selectAccount === true;
    const hint = (selectAccount || !getRememberMe()) ? '' : (rememberedAccount?.email || getActiveEmail() || '');
    // Returning user: pre-select the remembered account and let Google skip the chooser/consent
    // when the grant already exists. New user or "use another account": show the chooser.
    tokenClient.requestAccessToken(hint ? { prompt: '', login_hint: hint } : { prompt: 'select_account' });
  }, [tokenClient, rememberedAccount, settlePendingRequest]);

  const logout = useCallback(() => {
    handleForceLogout();
  }, [handleForceLogout]);

  const handleProfileSave = useCallback((updatedProfile) => {
    const email = getActiveEmail();
    if (!email) return;
    const profileToSave = { ...updatedProfile, isCustomized: true };
    saveProfile(profileToSave, email);
    setProfile(profileToSave);
    setRememberedAccount(getRememberMe() ? buildRememberedAccount(email) : null);
    if (accessToken) {
      syncManager.queueSync(accessToken, email);
    }
  }, [accessToken]);

  const updateProfileFromGoogle = useCallback((userProfile) => {
    const userEmail = userProfile.email;
    setActiveEmail(userEmail);
    const existingProfile = getProfile(userEmail);
    const rawMerged = existingProfile && existingProfile.isCustomized
      ? { ...userProfile, ...existingProfile, email: userEmail }
      : userProfile;
    const mergedProfile = hydrateProfileStudentId(rawMerged, userEmail);
    saveProfile(mergedProfile, userEmail);
    setProfile(mergedProfile);
    setRememberedAccount(getRememberMe() ? buildRememberedAccount(userEmail) : null);
    return userEmail;
  }, []);

  const isCachedSession = Boolean(!isLoggedIn && rememberedAccount?.email);

  const value = React.useMemo(() => ({
    accessToken, isLoggedIn, isCachedSession, profile, rememberedAccount,
    rememberMe, handleRememberMeChange,
    authError, clearAuthError, isAuthReady: Boolean(tokenClient),
    login, logout, expireSession,
    handleProfileSave, updateProfileFromGoogle, initClient,
    handleSilentRefresh
  }), [
    accessToken, isLoggedIn, isCachedSession, profile, rememberedAccount,
    rememberMe, handleRememberMeChange,
    authError, clearAuthError, tokenClient,
    login, logout, expireSession,
    handleProfileSave, updateProfileFromGoogle, initClient,
    handleSilentRefresh
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
