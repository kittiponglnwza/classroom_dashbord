import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getToken, saveToken, clearToken, getActiveEmail, setActiveEmail, 
  getProfile, saveProfile
} from '../utils/storage';
import { initGoogleClient } from '../services/googleClassroom';
import { StorageRepository } from '../repositories/StorageRepository';
import { httpClient } from '../utils/httpClient';
import { logger } from '../utils/logger';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState({});
  const [tokenClient, setTokenClient] = useState(null);

  // Setup httpClient callbacks to handle 401s and logouts centrally
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
  }, [tokenClient]);

  useEffect(() => {
    const sessionToken = getToken();
    const activeEmail = getActiveEmail();
    if (sessionToken && activeEmail) {
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

  const handleSilentRefresh = () => {
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        reject(new Error('Google Token Client is not initialized yet.'));
        return;
      }

      // Intercept the token client callback to resolve this promise
      const originalCallback = tokenClient.callback;
      tokenClient.callback = (tokenResponse) => {
        // Restore the original OAuth client callback
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
        // requestAccessToken with prompt 'none' silently fetches new access tokens
        tokenClient.requestAccessToken({ prompt: 'none' });
      } catch (err) {
        tokenClient.callback = originalCallback;
        reject(err);
      }
    });
  };

  const handleForceLogout = () => {
    clearToken();
    setActiveEmail('');
    setAccessToken(null);
    setIsLoggedIn(false);
    setProfile({});
    StorageRepository.clearMemoryCache();
  };

  const initClient = (lang, onTokenSuccess) => {
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
  };

  const login = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    } else {
      logger.error('Google OAuth client not initialized.');
    }
  };

  const logout = () => {
    // Normal logout cleans tokens and state directly
    handleForceLogout();
  };

  const handleProfileSave = (updatedProfile) => {
    const email = getActiveEmail();
    const profileToSave = { ...updatedProfile, isCustomized: true };
    saveProfile(profileToSave, email);
    setProfile(profileToSave);
  };

  const updateProfileFromGoogle = (userProfile) => {
    const userEmail = userProfile.email;
    setActiveEmail(userEmail);
    const existingProfile = getProfile(userEmail);
    const mergedProfile = existingProfile && existingProfile.isCustomized
      ? { ...userProfile, ...existingProfile, email: userEmail }
      : userProfile;
    saveProfile(mergedProfile, userEmail);
    setProfile(mergedProfile);
    return userEmail;
  };

  const value = React.useMemo(() => ({
    accessToken, isLoggedIn, profile, login, logout, 
    handleProfileSave, updateProfileFromGoogle, initClient,
    handleSilentRefresh
  }), [accessToken, isLoggedIn, profile, tokenClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
