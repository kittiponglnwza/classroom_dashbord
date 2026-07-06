import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getEnableEmailAlerts, setEnableEmailAlerts, getAlertSettings, 
  saveAlertSettings, getSundayDigestTime, setSundayDigestTime, 
  getNotificationHistory, getDailyEmailLimit, addNotificationHistoryLog,
  getActiveEmail
} from '../utils/storage';
import { useAuth } from './AuthContext';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const { isLoggedIn } = useAuth();
  const [lang, setLang] = useState(() => localStorage.getItem('classroom_hub_language') || 'en');
  const userEmail = getActiveEmail();

  // Alert settings states
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [alertSettings, setAlertSettingsState] = useState({});
  const [sundayTime, setSundayTimeState] = useState('18:00');
  const [historyLogs, setHistoryLogs] = useState([]);
  const [dailyLimit, setDailyLimit] = useState({ count: 0 });

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
  };

  const handleToggleSetting = (field) => {
    const updated = { ...alertSettings, [field]: !alertSettings[field] };
    setAlertSettingsState(updated);
    saveAlertSettings(updated, userEmail);
  };

  const handleTimeChange = (time) => {
    setSundayTimeState(time);
    setSundayDigestTime(time, userEmail);
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
    historyLogs, dailyLimit, refreshNotificationData
  }), [lang, emailAlerts, alertSettings, sundayTime, historyLogs, dailyLimit]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);
