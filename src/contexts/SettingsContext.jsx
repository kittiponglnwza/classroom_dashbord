/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getEnableEmailAlerts, setEnableEmailAlerts, getAlertSettings, 
  saveAlertSettings, getSundayDigestTime, setSundayDigestTime, 
  getNotificationHistory, getDailyEmailLimit, addNotificationHistoryLog,
  getActiveEmail
} from '../utils/storage';
import { useAuth } from './AuthContext';
import { syncManager } from '../services/SyncManager';

export const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const { isLoggedIn, accessToken } = useAuth();
  const [lang, setLang] = useState(() => localStorage.getItem('classroom_hub_language') || 'en');
  const userEmail = getActiveEmail();

  const [emailAlerts, setEmailAlerts] = useState(false);
  const [alertSettings, setAlertSettingsState] = useState({});
  const [sundayTime, setSundayTimeState] = useState('18:00');
  const [historyLogs, setHistoryLogs] = useState([]);
  const [dailyLimit, setDailyLimit] = useState({ count: 0 });

  const reloadSettings = useCallback(() => {
    const email = getActiveEmail();
    if (!email) return;
    const savedUserLang = localStorage.getItem(`classroom_hub_${email}_language`);
    if (savedUserLang) {
      setLang(savedUserLang);
      localStorage.setItem('classroom_hub_language', savedUserLang);
    }
    setEmailAlerts(getEnableEmailAlerts(email));
    setAlertSettingsState(getAlertSettings(email));
    setSundayTimeState(getSundayDigestTime(email));
    setHistoryLogs(getNotificationHistory(email));
    setDailyLimit(getDailyEmailLimit(email));
  }, []);

  useEffect(() => {
    if (userEmail && isLoggedIn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reloadSettings();
    }
  }, [userEmail, isLoggedIn, reloadSettings]);

  const toggleLang = useCallback(() => {
    const nextLang = lang === 'en' ? 'th' : 'en';
    setLang(nextLang);
    localStorage.setItem('classroom_hub_language', nextLang);
    if (userEmail) {
      localStorage.setItem(`classroom_hub_${userEmail}_language`, nextLang);
      syncManager.queueSync(accessToken, userEmail);
    }
  }, [lang, userEmail, accessToken]);

  const handleToggleAlerts = useCallback((val) => {
    setEmailAlerts(val);
    setEnableEmailAlerts(val, userEmail);
    addNotificationHistoryLog({
      title: val 
        ? (lang === 'en' ? 'Enabled Gmail Notification System' : 'เปิดใช้งานระบบแจ้งเตือนทาง Gmail')
        : (lang === 'en' ? 'Disabled Gmail Notification System' : 'ปิดใช้งานระบบแจ้งเตือนทาง Gmail'),
      type: 'settings_change'
    }, userEmail);
    setHistoryLogs(getNotificationHistory(userEmail));
    syncManager.queueSync(accessToken, userEmail);
  }, [userEmail, lang, accessToken]);

  const handleToggleSetting = useCallback((field) => {
    const updated = { ...alertSettings, [field]: !alertSettings[field] };
    setAlertSettingsState(updated);
    saveAlertSettings(updated, userEmail);
    syncManager.queueSync(accessToken, userEmail);
  }, [alertSettings, userEmail, accessToken]);

  const handleUpdateSetting = useCallback((field, value) => {
    const updated = { ...alertSettings, [field]: value };
    setAlertSettingsState(updated);
    saveAlertSettings(updated, userEmail);
    syncManager.queueSync(accessToken, userEmail);
  }, [alertSettings, userEmail, accessToken]);

  const handleTimeChange = useCallback((time) => {
    setSundayTimeState(time);
    setSundayDigestTime(time, userEmail);
    syncManager.queueSync(accessToken, userEmail);
  }, [userEmail, accessToken]);

  const refreshNotificationData = useCallback(() => {
    if (userEmail) {
      setHistoryLogs(getNotificationHistory(userEmail));
      setDailyLimit(getDailyEmailLimit(userEmail));
    }
  }, [userEmail]);


  const value = React.useMemo(() => ({
    lang, toggleLang, setLang,
    emailAlerts, handleToggleAlerts,
    alertSettings, handleToggleSetting, handleUpdateSetting,
    sundayTime, handleTimeChange,
    historyLogs, dailyLimit, refreshNotificationData,
    reloadSettings
  }), [
    lang, toggleLang,
    emailAlerts, handleToggleAlerts,
    alertSettings, handleToggleSetting, handleUpdateSetting,
    sundayTime, handleTimeChange,
    historyLogs, dailyLimit, refreshNotificationData,
    reloadSettings
  ]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);
