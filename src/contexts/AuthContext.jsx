import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getToken, saveToken, clearToken, getActiveEmail, setActiveEmail, 
  getProfile, saveProfile
} from '../utils/storage';
import { initGoogleClient } from '../services/googleClassroom';
import { t } from '../utils/i18n';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState({});
  const [tokenClient, setTokenClient] = useState(null);

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
            console.error('Google authorization error:', err);
            alert(t('authAuthError', lang));
          }
        );
        setTokenClient(client);
      }
    }, 400);
    return () => clearInterval(checkGisLoaded);
  };

  const login = (lang) => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    } else {
      alert(t('authInitError', lang));
    }
  };

  const logout = (lang) => {
    if (confirm(t('disconnectConfirm', lang))) {
      clearToken();
      setActiveEmail('');
      setAccessToken(null);
      setIsLoggedIn(false);
      setProfile({});
    }
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

  const value = {
    accessToken, isLoggedIn, profile, login, logout, 
    handleProfileSave, updateProfileFromGoogle, initClient
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
