import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { parseExamDate } from '../../utils/examDate';
import { parseLocalDateInput } from '../../utils/dateUtils';
import { mergeExamSources } from '../../utils/examMerger';
import { examRepository } from '../../repositories/examRepository';
import { syncManager } from '../../services/SyncManager';
import { calendarSyncManager } from '../../services/CalendarSyncManager';
import { getToken, recordDeletedId } from '../../utils/storage';
import { logger } from '../../utils/logger';
import { EXAM_CONFIG } from '../../config/exam';
import { t } from '../../utils/i18n';

const notifyExamsUpdated = (email) => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('classroom_hub_exams_updated', { detail: { email } }));
  }
};

const resolveOwnStudentId = (activeEmail = '', profileStudentId = '') => {
  // Explicit Student ID saved in Settings takes priority over email digits
  const cleanProfileId = String(profileStudentId || '').replace(/[\s-]/g, '').trim();
  if (/^\d{13}$/.test(cleanProfileId)) return cleanProfileId;
  const digitsMatch = String(activeEmail || '').match(/\d{13}/);
  if (digitsMatch) return digitsMatch[0];
  return '';
};

const resolveInitialStudentId = (activeEmail = '', profileStudentId = '') => {
  return resolveOwnStudentId(activeEmail, profileStudentId) || sessionStorage.getItem('lastExamSearch') || '';
};

export const useExamRoom = (activeEmail, lang, profileStudentId = '') => {
  const scopeKey = `${activeEmail || ''}::${String(profileStudentId || '').replace(/[\s-]/g, '').trim()}`;
  const ownStudentId = resolveOwnStudentId(activeEmail, profileStudentId);
  const [prevScopeKey, setPrevScopeKey] = useState(scopeKey);
  const [studentId, setStudentId] = useState(() => resolveInitialStudentId(activeEmail, profileStudentId));
  const [searchedStudentId, setSearchedStudentId] = useState(() => resolveInitialStudentId(activeEmail, profileStudentId));
  
  const [prevStudentId, setPrevStudentId] = useState(studentId);

  // Initialize Cache Synchronously
  const initialCache = useMemo(() => {
    const cachedResult = examRepository.getCachedExams(activeEmail);
    if (cachedResult.success && cachedResult.data) {
      return cachedResult.data;
    }
    return { exams: [], manualExams: [], unlisted: null };
  }, [activeEmail]);

  const [examList, setExamList] = useState(initialCache.exams || []);
  const [manualExamList, setManualExamList] = useState(initialCache.manualExams || []);
  const manualExamListRef = useRef(manualExamList);
  useEffect(() => {
    manualExamListRef.current = manualExamList;
  }, [manualExamList]);

  const [unlistedInfo, setUnlistedInfo] = useState(initialCache.unlisted || null);
  const initialHasSciBaseCache = Boolean((initialCache.exams && initialCache.exams.length > 0) || initialCache.unlisted);
  const [sciBaseChecked, setSciBaseChecked] = useState(initialHasSciBaseCache);
  const [searchTriggered, setSearchTriggered] = useState(() => {
    const hasSearched = !!sessionStorage.getItem('lastExamSearch');
    return hasSearched || initialHasSciBaseCache;
  });

  // State Machine: 'idle' | 'loading' | 'success' | 'error'
  const [status, setStatus] = useState(() => {
    if (initialHasSciBaseCache) return 'success';
    const cleanInitId = String(resolveInitialStudentId(activeEmail, profileStudentId) || '').replace(/[\s-]/g, '').trim();
    return EXAM_CONFIG.seatingLookupEnabled && /^\d{13}$/.test(cleanInitId) ? 'loading' : 'idle';
  });
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Adjust state when activeEmail or profileStudentId (from Settings) changes
  if (scopeKey !== prevScopeKey) {
    setPrevScopeKey(scopeKey);
    const nextStudentId = resolveInitialStudentId(activeEmail, profileStudentId);
    setStudentId(nextStudentId);
    setSearchedStudentId(nextStudentId);
    setPrevStudentId(nextStudentId);

    const cachedResult = examRepository.getCachedExams(activeEmail);
    const parsed = (cachedResult.success && cachedResult.data) ? cachedResult.data : { exams: [], manualExams: [], unlisted: null };
    const nextHasSciBase = Boolean((parsed.exams && parsed.exams.length > 0) || parsed.unlisted);
    setExamList(parsed.exams || []);
    setManualExamList(parsed.manualExams || []);
    setUnlistedInfo(parsed.unlisted || null);
    setSciBaseChecked(nextHasSciBase);
    const hasSearched = !!sessionStorage.getItem('lastExamSearch');
    setSearchTriggered(hasSearched || nextHasSciBase || !!(parsed.manualExams && parsed.manualExams.length > 0));
    setStatus(
      nextHasSciBase
        ? 'success'
        : (EXAM_CONFIG.seatingLookupEnabled && /^\d{13}$/.test(String(nextStudentId || '').replace(/[\s-]/g, '').trim()) ? 'loading' : 'idle')
    );
    setError(null);
  }

  // Bulletproof sync on mount (does NOT skip SciBase check when only Reg/manual exams are cached)
  useEffect(() => {
    if (activeEmail) {
      const cachedResult = examRepository.getCachedExams(activeEmail);
      if (cachedResult.success && cachedResult.data) {
        const data = cachedResult.data;
        const hasExams = data.exams && data.exams.length > 0;
        const hasManual = data.manualExams && data.manualExams.length > 0;
        if (hasExams || hasManual || data.unlisted) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setExamList(data.exams || []);
          setManualExamList(data.manualExams || []);
          setUnlistedInfo(data.unlisted || null);
          setSearchTriggered(true);
          if (hasExams || data.unlisted) {
            setSciBaseChecked(true);
            setStatus('success');
          }
        }
      }
    }
  }, [activeEmail]);

  // Clear validation error when user edits studentId (without wiping cached exams on backspace)
  if (studentId !== prevStudentId) {
    setPrevStudentId(studentId);
    if (error) {
      setError(null);
    }
  }

  const handleSearch = useCallback(async (e, overrideStudentId = null) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const targetIdInput = overrideStudentId !== null ? overrideStudentId : studentId;
    const validResult = examRepository.validateStudentId(targetIdInput, lang);
    if (!validResult.success) {
      setError(validResult.error.message);
      setStatus('error');
      return;
    }

    if (!EXAM_CONFIG.seatingLookupEnabled) {
      setError(t('examLookupUnavailable', lang));
      setStatus('error');
      return;
    }

    const cleanId = validResult.data;
    const isOtherStudent = Boolean(ownStudentId && cleanId !== ownStudentId);
    setStatus('loading');
    setError(null);
    setExamList([]);
    setUnlistedInfo(null);
    setSearchTriggered(true);
    setSearchedStudentId(cleanId);
    if (overrideStudentId !== null) {
      setStudentId(cleanId);
    }
    if (!isOtherStudent) {
      sessionStorage.setItem('lastExamSearch', cleanId);
    }

    const requestController = new AbortController();
    abortControllerRef.current = requestController;

    const result = await examRepository.fetchExams(cleanId, lang, requestController.signal);
    if (requestController.signal.aborted) {
      if (abortControllerRef.current === requestController) {
        setStatus('idle');
      }
      return;
    }
    
    if (result.success) {
      const freshCache = examRepository.getCachedExams(activeEmail);
      const latestManual = (freshCache.success && freshCache.data?.manualExams)
        ? freshCache.data.manualExams
        : manualExamListRef.current;
      setExamList(result.data.exams);
      setManualExamList(latestManual);
      setUnlistedInfo(result.data.unlisted);
      setSciBaseChecked(true);
      setStatus('success');

      // Only persist & sync to Drive/Calendar when searching the logged-in user's own Student ID
      if (!isOtherStudent) {
        examRepository.saveToCache(activeEmail, result.data.exams, latestManual, result.data.unlisted);
        notifyExamsUpdated(activeEmail);
        const token = getToken();
        if (token && activeEmail) {
          syncManager.queueSync(token, activeEmail);
          calendarSyncManager.queueSync(token, activeEmail);
        }
      }
    } else {
      if (result.error.name === 'AbortError') {
        return;
      }
      setSciBaseChecked(true);
      setError(result.error.message);
      setStatus('error');
    }
  }, [studentId, lang, activeEmail, ownStudentId]);

  // Check SciBase before using the KMUTNB Reg fallback only when its transport is enabled.
  useEffect(() => {
    if (!EXAM_CONFIG.seatingLookupEnabled) return;

    const cleanId = String(studentId || '').replace(/[\s-]/g, '').trim();
    if (!/^\d{13}$/.test(cleanId) || sciBaseChecked) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let completed = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading');
    setError(null);
    sessionStorage.setItem('lastExamSearch', cleanId);

    examRepository.fetchExams(cleanId, lang, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      completed = true;
      if (result.success) {
        const freshCache = examRepository.getCachedExams(activeEmail);
        const latestManual = (freshCache.success && freshCache.data?.manualExams)
          ? freshCache.data.manualExams
          : manualExamListRef.current;
        setExamList(result.data.exams);
        setManualExamList(latestManual);
        setUnlistedInfo(result.data.unlisted);
        setSearchTriggered(true);
        setSciBaseChecked(true);
        examRepository.saveToCache(activeEmail, result.data.exams, latestManual, result.data.unlisted);
        notifyExamsUpdated(activeEmail);
        setStatus('success');

        const token = getToken();
        if (token && activeEmail) {
          syncManager.queueSync(token, activeEmail);
          calendarSyncManager.queueSync(token, activeEmail);
        }
      } else {
        if (result.error?.name === 'AbortError') return;
        setSearchTriggered(true);
        setSciBaseChecked(true);
        setError(result.error?.message || 'Failed to fetch exams');
        setStatus('error');
      }
    }).catch((err) => {
      if (controller.signal.aborted || err?.name === 'AbortError') return;
      completed = true;
      setSearchTriggered(true);
      setSciBaseChecked(true);
      setError(err?.message || 'Failed to fetch exams');
      setStatus('error');
    });

    return () => {
      controller.abort();
      if (!completed && abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    };
  }, [studentId, sciBaseChecked, lang, activeEmail]);

  const handleSaveManualExam = useCallback((examData) => {
    let updatedManual = [...manualExamList];
    if (examData.id && examData.id !== 'new') {
      const idx = updatedManual.findIndex(ex => ex.id === examData.id);
      if (idx !== -1) {
        updatedManual[idx] = {
          ...examData,
          updatedAt: new Date().toISOString()
        };
      }
    } else {
      updatedManual.push({
        ...examData,
        id: `manual-exam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        updatedAt: new Date().toISOString()
      });
    }

    setManualExamList(updatedManual);
    setSearchTriggered(true);
    examRepository.saveToCache(activeEmail, examList, updatedManual, unlistedInfo);
    notifyExamsUpdated(activeEmail);

    // Queue synchronization with Google Drive
    const token = getToken();
    if (token && activeEmail) {
      syncManager.queueSync(token, activeEmail);
      calendarSyncManager.queueSync(token, activeEmail);
    }
  }, [manualExamList, examList, unlistedInfo, activeEmail]);

  const handleDeleteManualExam = useCallback((id) => {
    logger.info(`Deleting manual exam: ${id}`);
    const updatedManual = manualExamListRef.current.filter(ex => ex.id !== id);
    setManualExamList(updatedManual);
    if (activeEmail) {
      recordDeletedId('manualExams', id, activeEmail);
    }
    examRepository.saveToCache(activeEmail, examList, updatedManual, unlistedInfo);
    notifyExamsUpdated(activeEmail);

    // Queue synchronization with Google Drive
    const token = getToken();
    if (token && activeEmail) {
      syncManager.queueSync(token, activeEmail);
      calendarSyncManager.queueSync(token, activeEmail);
    }
  }, [examList, unlistedInfo, activeEmail]);

  const isViewingOtherStudentId = Boolean(ownStudentId && searchedStudentId && searchedStudentId !== ownStudentId);

  const mergedExamResult = useMemo(
    () => (isViewingOtherStudentId
      ? mergeExamSources(examList, [])
      : mergeExamSources(examList, manualExamList)),
    [examList, manualExamList, isViewingOtherStudentId]
  );

  const sortExamsChronologically = useCallback((list) => {
    const parseDateForSort = (exam) => {
      let dateObj;
      if (exam.rawIsoDate) {
        dateObj = parseLocalDateInput(exam.rawIsoDate);
      } else {
        dateObj = parseExamDate(exam.date);
      }
      
      if (!dateObj) return new Date(8640000000000000).getTime();

      if (exam.time) {
        const timeMatch = exam.time.match(/(\d{1,2})[:.](\d{2})/);
        if (timeMatch) {
          dateObj.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
        }
      }
      
      return dateObj.getTime();
    };

    return [...list].sort((a, b) => parseDateForSort(a) - parseDateForSort(b));
  }, []);

  const sortedExams = useMemo(
    () => sortExamsChronologically(mergedExamResult.exams),
    [mergedExamResult.exams, sortExamsChronologically]
  );

  const rawSciBaseExams = useMemo(
    () => sortExamsChronologically(examList.map((ex) => ({ ...ex, source: 'scibase' }))),
    [examList, sortExamsChronologically]
  );

  const sciBaseMeta = useMemo(() => {
    const first = examList[0];
    return {
      count: examList.length,
      termLabel: first?.termLabel || '',
      examType: first?.examType || '',
    };
  }, [examList]);

  const isSciBaseOutdatedFallback = !isViewingOtherStudentId
    && mergedExamResult.stats.mode === 'reg-fallback'
    && mergedExamResult.stats.ignoredStaleSciBaseCount > 0;

  const isOutdatedData = useMemo(() => {
    if (examList.length === 0 || (!isViewingOtherStudentId && mergedExamResult.stats.mode === 'reg-fallback')) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return examList.every(exam => {
      const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
      return parsedDate ? parsedDate < today : false;
    });
  }, [examList, mergedExamResult.stats.mode, isViewingOtherStudentId]);

  const refreshFromCache = useCallback(() => {
    const cachedResult = examRepository.getCachedExams(activeEmail);
    if (cachedResult.success && cachedResult.data) {
      const data = cachedResult.data;
      setExamList(data.exams || []);
      setManualExamList(data.manualExams || []);
      setUnlistedInfo(data.unlisted || null);
      if ((data.exams && data.exams.length > 0) || (data.manualExams && data.manualExams.length > 0) || data.unlisted) {
        setSearchTriggered(true);
      }
    }
  }, [activeEmail]);

  const resetToOwnStudentId = useCallback(() => {
    if (!ownStudentId) return;
    handleSearch(null, ownStudentId);
  }, [ownStudentId, handleSearch]);

  useEffect(() => {
    const onExamsUpdated = () => refreshFromCache();
    window.addEventListener('classroom_hub_exams_updated', onExamsUpdated);
    return () => window.removeEventListener('classroom_hub_exams_updated', onExamsUpdated);
  }, [refreshFromCache]);

  return {
    studentId,
    setStudentId,
    ownStudentId,
    searchedStudentId,
    isViewingOtherStudentId,
    status,
    error,
    sortedExams,
    rawSciBaseExams,
    sciBaseMeta,
    unlistedInfo,
    searchTriggered,
    sciBaseChecked,
    isOutdatedData,
    isSciBaseOutdatedFallback,
    mergeStats: mergedExamResult.stats,
    handleSearch,
    resetToOwnStudentId,
    handleSaveManualExam,
    handleDeleteManualExam,
    refreshFromCache
  };
};
