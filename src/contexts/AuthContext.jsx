/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getToken, saveToken, clearToken, getActiveEmail, setActiveEmail, 
  getProfile, saveProfile
} from '../utils/storage';
import { initGoogleClient } from '../services/googleClassroomClient';
import { StorageRepository } from '../repositories/StorageRepository';
import { httpClient } from '../utils/httpClient';
import { logger } from '../utils/logger';

/**
 * @typedef {Object} AuthContextType
 * @property {string|null} accessToken
 * @property {boolean} isLoggedIn
 * @property {import('../types/models').UserProfile} profile
 * @property {() => void} login
 * @property {() => void} logout
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

  const handleSilentRefresh = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        reject(new Error('Google Token Client is not initialized yet.'));
        return;
      }

      const originalCallback = tokenClient.callback;
      tokenClient.callback = (tokenResponse) => {
        tokenClient.callback = originalCallback;

        if (tokenResponse.error) {
          logger.error('[Auth] Silent token refresh failed:', tokenResponse.error);
          reject(new Error(`Silent OAuth refresh error: ${tokenResponse.error}`));
        } else {
          const token = tokenResponse.access_token;
          logger.info('[Auth] Silent token refresh succeeded.');
          setAccessToken(token);
          saveToken(token);
          setIsLoggedIn(true);
          resolve(token);
        }
      };

      try {
        tokenClient.requestAccessToken({ prompt: 'none' });
      } catch (err) {
        tokenClient.callback = originalCallback;
        reject(err);
      }
    });
  }, [tokenClient]);

  const handleForceLogout = useCallback(() => {
    clearToken();
    setActiveEmail('');
    setAccessToken(null);
    setIsLoggedIn(false);
    setProfile({});
    StorageRepository.clearMemoryCache();
  }, []);

  useEffect(() => {
    httpClient.registerCallbacks(
      async () => {
        logger.info('[Auth] Interceptor triggered silent refresh.');
        return await handleSilentRefresh();
      },
      () => {
        logger.warn('[Auth] Interceptor triggered force logout.');
        handleForceLogout();
      }
    );
  }, [handleSilentRefresh, handleForceLogout]);

  useEffect(() => {
    const sessionToken = getToken();
    const activeEmail = getActiveEmail();
    if (sessionToken && activeEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccessToken(sessionToken);
      setIsLoggedIn(true);
      setProfile(getProfile(activeEmail));
    } else {
      if (sessionToken) clearToken();
      setActiveEmail('');
      setIsLoggedIn(false);
      setAccessToken(null);
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
            saveToken(token);
            setIsLoggedIn(true);
            if (onTokenSuccess) onTokenSuccess(token);
          },
          (err) => {
            logger.error('Google authorization failed:', err);
          }
        );
        setTokenClient(client);
      }
    }, 400);
    return () => clearInterval(checkGisLoaded);
  }, []);

  const login = useCallback(() => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    } else {
      logger.error('Google OAuth client not initialized.');
    }
  }, [tokenClient]);

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
    return userEmail;
  }, []);

  const value = React.useMemo(() => ({
    accessToken, isLoggedIn, profile, login, logout, 
    handleProfileSave, updateProfileFromGoogle, initClient,
    handleSilentRefresh
  }), [
    accessToken, isLoggedIn, profile, login, logout, 
    handleProfileSave, updateProfileFromGoogle, initClient,
    handleSilentRefresh
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
