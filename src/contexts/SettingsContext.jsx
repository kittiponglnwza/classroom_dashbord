import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  getEnableEmailAlerts, setEnableEmailAlerts, getAlertSettings, 
  saveAlertSettings, getSundayDigestTime, setSundayDigestTime, 
  getNotificationHistory, getDailyEmailLimit, addNotificationHistoryLog,
  getActiveEmail, touchLocalSettingsTimestamp
} from '../utils/storage';
import { useAuth } from './AuthContext';
import { syncSettingsWithDrive } from '../services/driveSync';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const { isLoggedIn, accessToken } = useAuth();
  const [lang, setLang] = useState(() => localStorage.getItem('classroom_hub_language') || 'en');
  const userEmail = getActiveEmail();

  // Alert settings states
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [alertSettings, setAlertSettingsState] = useState({});
  const [sundayTime, setSundayTimeState] = useState('18:00');
  const [historyLogs, setHistoryLogs] = useState([]);
  const [dailyLimit, setDailyLimit] = useState({ count: 0 });

  // Debounce timer ref for Drive sync pushes
  const pushTimerRef = useRef(null);

  /**
   * Debounced push to Google Drive (1 second).
   * Coalesces rapid changes into a single API call.
   * Errors are caught silently so local UI is never blocked.
   */
  const pushSettingsToDrive = useCallback(() => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      const token = accessToken;
      const email = getActiveEmail();
      if (token && email) {
        syncSettingsWithDrive(token, email).catch(err => {
          console.error('[Classroom Hub Settings] Failed to push settings to Drive:', err);
        });
      }
    }, 1000);
  }, [accessToken]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, []);

  /**
   * Reloads all settings state from localStorage.
   * Called after remote settings are applied so the UI reflects the latest values.
   */
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
      const savedUserLang = localStorage.getItem(`classroom_hub_${userEmail}_language`);
      if (savedUserLang) {
        setLang(savedUserLang);
        localStorage.setItem('classroom_hub_language', savedUserLang);
      }
      setEmailAlerts(getEnableEmailAlerts(userEmail));
      setAlertSettingsState(getAlertSettings(userEmail));
      setSundayTimeState(getSundayDigestTime(userEmail));
      setHistoryLogs(getNotificationHistory(userEmail));
      setDailyLimit(getDailyEmailLimit(userEmail));
    }
  }, [userEmail, isLoggedIn]);

  const toggleLang = () => {
    const nextLang = lang === 'en' ? 'th' : 'en';
    setLang(nextLang);
    localStorage.setItem('classroom_hub_language', nextLang);
    if (userEmail) {
      localStorage.setItem(`classroom_hub_${userEmail}_language`, nextLang);
      touchLocalSettingsTimestamp(userEmail);
      pushSettingsToDrive();
    }
  };

  const handleToggleAlerts = (val) => {
    setEmailAlerts(val);
    setEnableEmailAlerts(val, userEmail);
    addNotificationHistoryLog({
      title: val 
        ? (lang === 'en' ? 'Enabled Gmail Notification System' : 'เปิดใช้งานระบบแจ้งเตือนทาง Gmail')
        : (lang === 'en' ? 'Disabled Gmail Notification System' : 'ปิดใช้งานระบบแจ้งเตือนทาง Gmail'),
      type: 'settings_change'
    }, userEmail);
    setHistoryLogs(getNotificationHistory(userEmail));
    pushSettingsToDrive();
  };

  const handleToggleSetting = (field) => {
    const updated = { ...alertSettings, [field]: !alertSettings[field] };
    setAlertSettingsState(updated);
    saveAlertSettings(updated, userEmail);
    pushSettingsToDrive();
  };

  const handleTimeChange = (time) => {
    setSundayTimeState(time);
    setSundayDigestTime(time, userEmail);
    pushSettingsToDrive();
  };

  const refreshNotificationData = () => {
    if (userEmail) {
      setHistoryLogs(getNotificationHistory(userEmail));
      setDailyLimit(getDailyEmailLimit(userEmail));
    }
  };

  const value = React.useMemo(() => ({
    lang, toggleLang, setLang,
    emailAlerts, handleToggleAlerts,
    alertSettings, handleToggleSetting,
    sundayTime, handleTimeChange,
    historyLogs, dailyLimit, refreshNotificationData,
    reloadSettings
  }), [lang, emailAlerts, alertSettings, sundayTime, historyLogs, dailyLimit, reloadSettings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);
