/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getEnableEmailAlerts, setEnableEmailAlerts, getAlertSettings,
  saveAlertSettings, getSundayDigestTime, setSundayDigestTime,
  getNotificationHistory, getDailyEmailLimit, addNotificationHistoryLog,
  markNotificationRead, markAllNotificationsRead,
  getActiveEmail
} from '../utils/storage';
import { useAuth } from './AuthContext';
import { syncManager } from '../services/SyncManager';
import { calendarSyncManager } from '../services/CalendarSyncManager';
import { NotificationService } from '../services/NotificationService';
import { getCookieConsent } from '../utils/cookieConsent';

export const SettingsContext = createContext(null);

const CALENDAR_SETTING_FIELDS = new Set([
  'calendarReminderEnabled',
  'calendarReminderValue',
  'calendarReminderUnit'
]);

function normalizeCalendarSettings(settings) {
  const unit = settings.calendarReminderUnit || 'minutes';
  const maxByUnit = unit === 'days' ? 28 : unit === 'hours' ? 672 : 40320;
  const parsed = parseInt(settings.calendarReminderValue, 10);
  const clamped = Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 0), maxByUnit)
    : 10;
  return {
    ...settings,
    calendarReminderUnit: unit,
    calendarReminderValue: clamped
  };
}

function normalizeTodayLimit(limitData) {
  const todayStamp = NotificationService.localDateStamp();
  if (!limitData || limitData.lastSentDate !== todayStamp) {
    return { lastSentDate: limitData?.lastSentDate || todayStamp, count: 0 };
  }
  return { ...limitData, count: Number(limitData.count) || 0 };
}

export const SettingsProvider = ({ children }) => {
  const { isLoggedIn, accessToken } = useAuth();
  const [lang, setLang] = useState(() => localStorage.getItem('classroom_hub_language') || 'en');
  const userEmail = getActiveEmail();

  const [emailAlerts, setEmailAlerts] = useState(false);
  const [alertSettings, setAlertSettingsState] = useState({});
  const alertSettingsRef = useRef(alertSettings);
  const [sundayTime, setSundayTimeState] = useState('18:00');
  const [historyLogs, setHistoryLogs] = useState([]);
  const [dailyLimit, setDailyLimit] = useState({ count: 0 });

  useEffect(() => {
    alertSettingsRef.current = alertSettings;
  }, [alertSettings]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'th' ? 'th' : 'en';
    }
  }, [lang]);

  const reloadSettings = useCallback(() => {
    const email = getActiveEmail();
    if (!email) {
      setEmailAlerts(false);
      setAlertSettingsState({});
      alertSettingsRef.current = {};
      setSundayTimeState('18:00');
      setHistoryLogs([]);
      setDailyLimit({ count: 0 });
      return;
    }
    const savedUserLang = localStorage.getItem(`classroom_hub_${email}_language`);
    if (savedUserLang) {
      setLang(savedUserLang);
      const consent = getCookieConsent();
      if (!consent || consent.preferences !== false) {
        localStorage.setItem('classroom_hub_language', savedUserLang);
      }
    }
    const nextAlertSettings = getAlertSettings(email);
    setEmailAlerts(getEnableEmailAlerts(email));
    setAlertSettingsState(nextAlertSettings);
    alertSettingsRef.current = nextAlertSettings;
    setSundayTimeState(getSundayDigestTime(email));
    setHistoryLogs(getNotificationHistory(email));
    setDailyLimit(normalizeTodayLimit(getDailyEmailLimit(email)));
  }, []);

  useEffect(() => {
    if (userEmail && isLoggedIn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reloadSettings();
    } else if (!isLoggedIn) {
      setEmailAlerts(false);
      setAlertSettingsState({});
      alertSettingsRef.current = {};
      setSundayTimeState('18:00');
      setHistoryLogs([]);
      setDailyLimit({ count: 0 });
    }
  }, [userEmail, isLoggedIn, reloadSettings]);

  const toggleLang = useCallback(() => {
    const email = getActiveEmail() || userEmail;
    const nextLang = lang === 'en' ? 'th' : 'en';
    setLang(nextLang);
    const consent = getCookieConsent();
    if (!consent || consent.preferences !== false) {
      localStorage.setItem('classroom_hub_language', nextLang);
      if (email) {
        localStorage.setItem(`classroom_hub_${email}_language`, nextLang);
        syncManager.queueSync(accessToken, email);
      }
    }
  }, [lang, userEmail, accessToken]);

  const handleToggleAlerts = useCallback((val) => {
    const email = getActiveEmail() || userEmail;
    setEmailAlerts(val);
    setEnableEmailAlerts(val, email);
    addNotificationHistoryLog({
      title: val
        ? (lang === 'en' ? 'Enabled Gmail Notification System' : 'เปิดใช้งานระบบแจ้งเตือนทาง Gmail')
        : (lang === 'en' ? 'Disabled Gmail Notification System' : 'ปิดใช้งานระบบแจ้งเตือนทาง Gmail'),
      type: 'settings_change',
      read: true
    }, email);
    setHistoryLogs(getNotificationHistory(email));
    syncManager.queueSync(accessToken, email);
  }, [userEmail, lang, accessToken]);

  const handleToggleSetting = useCallback((field) => {
    const email = getActiveEmail() || userEmail;
    const current = alertSettingsRef.current || {};
    const updated = normalizeCalendarSettings({ ...current, [field]: !current[field] });
    alertSettingsRef.current = updated;
    setAlertSettingsState(updated);
    saveAlertSettings(updated, email);
    syncManager.queueSync(accessToken, email);
    if (CALENDAR_SETTING_FIELDS.has(field)) {
      calendarSyncManager.queueSync(accessToken, email);
    }
  }, [userEmail, accessToken]);

  const handleUpdateSetting = useCallback((field, value) => {
    const email = getActiveEmail() || userEmail;
    const current = alertSettingsRef.current || {};
    const updated = normalizeCalendarSettings({ ...current, [field]: value });
    alertSettingsRef.current = updated;
    setAlertSettingsState(updated);
    saveAlertSettings(updated, email);
    syncManager.queueSync(accessToken, email);
    if (CALENDAR_SETTING_FIELDS.has(field)) {
      calendarSyncManager.queueSync(accessToken, email);
    }
  }, [userEmail, accessToken]);

  const handleTimeChange = useCallback((time) => {
    const email = getActiveEmail() || userEmail;
    setSundayTimeState(time);
    setSundayDigestTime(time, email);
    syncManager.queueSync(accessToken, email);
  }, [userEmail, accessToken]);

  const refreshNotificationData = useCallback(() => {
    const email = getActiveEmail() || userEmail;
    if (email) {
      setHistoryLogs(getNotificationHistory(email));
      setDailyLimit(normalizeTodayLimit(getDailyEmailLimit(email)));
    }
  }, [userEmail]);

  const handleMarkNotificationRead = useCallback((id, read = true) => {
    const email = getActiveEmail() || userEmail;
    if (!email) return;
    const updated = markNotificationRead(id, email, read);
    setHistoryLogs(updated);
    syncManager.queueSync(accessToken, email);
  }, [userEmail, accessToken]);

  const handleMarkAllNotificationsRead = useCallback(() => {
    const email = getActiveEmail() || userEmail;
    if (!email) return;
    const updated = markAllNotificationsRead(email);
    setHistoryLogs(updated);
    syncManager.queueSync(accessToken, email);
  }, [userEmail, accessToken]);

  useEffect(() => {
    const handleSameTabNotificationUpdate = () => {
      refreshNotificationData();
    };
    const handleCrossTabStorage = (e) => {
      if (!e.key) return;
      if (e.key.startsWith('classroom_hub_')) {
        reloadSettings();
      }
    };
    window.addEventListener('classroom_hub_notifications_updated', handleSameTabNotificationUpdate);
    window.addEventListener('storage', handleCrossTabStorage);
    return () => {
      window.removeEventListener('classroom_hub_notifications_updated', handleSameTabNotificationUpdate);
      window.removeEventListener('storage', handleCrossTabStorage);
    };
  }, [refreshNotificationData, reloadSettings]);

  const unreadCount = React.useMemo(
    () => historyLogs.filter(log => !log.read).length,
    [historyLogs]
  );

  const value = React.useMemo(() => ({
    lang, toggleLang, setLang,
    emailAlerts, handleToggleAlerts,
    alertSettings, handleToggleSetting, handleUpdateSetting,
    sundayTime, handleTimeChange,
    historyLogs, unreadCount, dailyLimit, refreshNotificationData,
    handleMarkNotificationRead, handleMarkAllNotificationsRead,
    reloadSettings
  }), [
    lang, toggleLang,
    emailAlerts, handleToggleAlerts,
    alertSettings, handleToggleSetting, handleUpdateSetting,
    sundayTime, handleTimeChange,
    historyLogs, unreadCount, dailyLimit, refreshNotificationData,
    handleMarkNotificationRead, handleMarkAllNotificationsRead,
    reloadSettings
  ]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);
