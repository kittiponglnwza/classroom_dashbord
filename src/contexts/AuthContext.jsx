/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  getToken, saveToken, clearToken, getActiveEmail, setActiveEmail, 
  getProfile, saveProfile, getRememberMe, setRememberMe
} from '../utils/storage';
import { initGoogleClient } from '../services/googleClassroomClient';
import { StorageRepository } from '../repositories/StorageRepository';
import { httpClient } from '../utils/httpClient';
import { logger } from '../utils/logger';

const SILENT_REFRESH_TIMEOUT_MS = 30 * 1000;

const buildRememberedAccount = (email) => {
  const stored = getProfile(email) || {};
  return { email, name: stored.name || '', picture: stored.picture || '' };
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
  const pendingTokenRequestRef = useRef(null);

  const handleRememberMeChange = useCallback((enabled) => {
    const next = Boolean(enabled);
    setRememberMe(next);
    setRememberMeState(next);
    if (!next) {
      setRememberedAccount(null);
    } else {
      const email = getActiveEmail();
      if (email) setRememberedAccount(buildRememberedAccount(email));
    }
  }, []);

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
    clearToken();
    setAccessToken(null);
    setIsLoggedIn(false);
    setProfile({});
    StorageRepository.clearMemoryCache();
  }, []);

  // Session expired / could not be refreshed: drop the token but keep the remembered account
  // when Remember Me is enabled.
  const expireSession = useCallback(() => {
    clearSessionState();
    if (getRememberMe()) {
      const email = getActiveEmail();
      setRememberedAccount(email ? buildRememberedAccount(email) : null);
    } else {
      setActiveEmail('');
      setRememberedAccount(null);
    }
  }, [clearSessionState]);

  // Explicit user logout: forget the account on this device as well.
  const handleForceLogout = useCallback(() => {
    clearSessionState();
    setActiveEmail('');
    setRememberedAccount(null);
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
      setProfile(getProfile(activeEmail));
    } else {
      clearToken();
      setIsLoggedIn(false);
      setAccessToken(null);
      setRememberedAccount(getRememberMe() && activeEmail ? buildRememberedAccount(activeEmail) : null);
    }
  }, []);

  const initClient = useCallback((lang, onTokenSuccess) => {
    const checkGisLoaded = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(checkGisLoaded);
        const client = initGoogleClient(
          (tokenResponse) => {
            const token = tokenResponse.access_token;
            setAccessToken(token);
            saveToken(token, tokenResponse.expires_in);
            setIsLoggedIn(true);
            if (settlePendingRequest(null, token)) {
              logger.info('[Auth] Silent token refresh succeeded.');
            }
            if (onTokenSuccess) onTokenSuccess(token);
          },
          (err) => {
            const error = new Error(`OAuth error: ${err?.error || 'unknown'}`);
            if (settlePendingRequest(error)) {
              logger.error('[Auth] Silent token refresh failed:', err?.error);
            } else {
              logger.error('Google authorization failed:', err);
            }
          }
        );
        setTokenClient(client);
      }
    }, 400);
    return () => clearInterval(checkGisLoaded);
  }, [settlePendingRequest]);

  const login = useCallback((options) => {
    if (!tokenClient) {
      logger.error('Google OAuth client not initialized.');
      return;
    }
    const selectAccount = typeof options === 'object' && options !== null && options.selectAccount === true;
    const hint = (selectAccount || !getRememberMe()) ? '' : (rememberedAccount?.email || getActiveEmail() || '');
    // Returning user: pre-select the remembered account and let Google skip the chooser/consent
    // when the grant already exists. New user or "use another account": show the chooser.
    tokenClient.requestAccessToken(hint ? { prompt: '', login_hint: hint } : { prompt: 'select_account' });
  }, [tokenClient, rememberedAccount]);

  const logout = useCallback(() => {
    handleForceLogout();
  }, [handleForceLogout]);

  const handleProfileSave = useCallback((updatedProfile) => {
    const email = getActiveEmail();
    const profileToSave = { ...updatedProfile, isCustomized: true };
    saveProfile(profileToSave, email);
    setProfile(profileToSave);
  }, []);

  const updateProfileFromGoogle = useCallback((userProfile) => {
    const userEmail = userProfile.email;
    setActiveEmail(userEmail);
    const existingProfile = getProfile(userEmail);
    const mergedProfile = existingProfile && existingProfile.isCustomized
      ? { ...userProfile, ...existingProfile, email: userEmail }
      : userProfile;
    saveProfile(mergedProfile, userEmail);
    setProfile(mergedProfile);
    setRememberedAccount(getRememberMe() ? buildRememberedAccount(userEmail) : null);
    return userEmail;
  }, []);

  const value = React.useMemo(() => ({
    accessToken, isLoggedIn, profile, rememberedAccount,
    rememberMe, handleRememberMeChange,
    login, logout, expireSession,
    handleProfileSave, updateProfileFromGoogle, initClient,
    handleSilentRefresh
  }), [
    accessToken, isLoggedIn, profile, rememberedAccount,
    rememberMe, handleRememberMeChange,
    login, logout, expireSession,
    handleProfileSave, updateProfileFromGoogle, initClient,
    handleSilentRefresh
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
