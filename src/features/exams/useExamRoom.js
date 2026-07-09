import { useState, useMemo, useCallback, useRef } from 'react';
import { parseExamDate } from '../../utils/examDate';
import { examRepository } from '../../repositories/examRepository';
import { syncManager } from '../../services/SyncManager';
import { getToken } from '../../utils/storage';
import { logger } from '../../utils/logger';

export const useExamRoom = (activeEmail, lang) => {
  const [prevEmail, setPrevEmail] = useState(activeEmail);
  const [studentId, setStudentId] = useState(() => {
    const digitsMatch = activeEmail.match(/\d{13}/);
    if (digitsMatch) return digitsMatch[0];
    return localStorage.getItem('lastExamSearch') || '';
  });
  
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
  const [unlistedInfo, setUnlistedInfo] = useState(initialCache.unlisted || null);
  const [searchTriggered, setSearchTriggered] = useState(!!(initialCache.exams && initialCache.exams.length > 0));
  
  // State Machine: 'idle' | 'loading' | 'success' | 'error'
  const [status, setStatus] = useState((initialCache.exams && initialCache.exams.length > 0) ? 'success' : 'idle');
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);

  // Adjust state when activeEmail prop changes
  if (activeEmail !== prevEmail) {
    setPrevEmail(activeEmail);
    const digitsMatch = activeEmail.match(/\d{13}/);
    const nextStudentId = digitsMatch ? digitsMatch[0] : (localStorage.getItem('lastExamSearch') || '');
    setStudentId(nextStudentId);
    setPrevStudentId(nextStudentId);

    const cachedResult = examRepository.getCachedExams(activeEmail);
    const parsed = (cachedResult.success && cachedResult.data) ? cachedResult.data : { exams: [], manualExams: [], unlisted: null };
    setExamList(parsed.exams || []);
    setManualExamList(parsed.manualExams || []);
    setUnlistedInfo(parsed.unlisted || null);
    setSearchTriggered(!!(parsed.exams && parsed.exams.length > 0));
    setStatus((parsed.exams && parsed.exams.length > 0) ? 'success' : 'idle');
    setError(null);
  }

  // Adjust state when studentId changes
  if (studentId !== prevStudentId) {
    setPrevStudentId(studentId);
    if (studentId.trim() === '') {
      setExamList([]);
      setUnlistedInfo(null);
      setSearchTriggered(false);
      setStatus('idle');
      setError(null);
      localStorage.removeItem('lastExamSearch');
      examRepository.clearExamsCache(activeEmail);
      
      // Sync deletion
      const token = getToken();
      if (token && activeEmail) {
        syncManager.queueSync(token, activeEmail);
      }
    }
  }

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const validResult = examRepository.validateStudentId(studentId, lang);
    if (!validResult.success) {
      setError(validResult.error.message);
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError(null);
    setExamList([]);
    setUnlistedInfo(null);
    setSearchTriggered(true);

    const cleanId = validResult.data;
    localStorage.setItem('lastExamSearch', cleanId);

    abortControllerRef.current = new AbortController();

    const result = await examRepository.fetchExams(cleanId, lang, abortControllerRef.current.signal);
    
    if (result.success) {
      setExamList(result.data.exams);
      setUnlistedInfo(result.data.unlisted);
      examRepository.saveToCache(activeEmail, result.data.exams, manualExamList, result.data.unlisted);
      setStatus('success');
      
      // Trigger background sync for the new seating arrangements
      const token = getToken();
      if (token && activeEmail) {
        syncManager.queueSync(token, activeEmail);
      }
    } else {
      if (result.error.name === 'AbortError') {
        return;
      }
      setError(result.error.message);
      setStatus('error');
    }
  };

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

    // Queue synchronization with Google Drive
    const token = getToken();
    if (token && activeEmail) {
      syncManager.queueSync(token, activeEmail);
    }
  }, [manualExamList, examList, unlistedInfo, activeEmail]);

  const handleDeleteManualExam = useCallback((id) => {
    // We removed window.confirm to avoid blocking native popups in production.
    // Component or custom UI modal can handle visual confirmations.
    logger.info(`Deleting manual exam: ${id}`);
    const updatedManual = manualExamList.filter(ex => ex.id !== id);
    setManualExamList(updatedManual);
    examRepository.saveToCache(activeEmail, examList, updatedManual, unlistedInfo);

    // Queue synchronization with Google Drive
    const token = getToken();
    if (token && activeEmail) {
      syncManager.queueSync(token, activeEmail);
    }
  }, [manualExamList, examList, unlistedInfo, activeEmail]);

  const sortedExams = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDateForSort = (exam) => {
      if (exam.rawIsoDate) return new Date(exam.rawIsoDate);
      const parsed = parseExamDate(exam.date);
      return parsed || new Date(8640000000000000);
    };

    return [...examList, ...manualExamList]
      .filter(exam => {
        const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
        return parsedDate ? parsedDate >= today : true;
      })
      .sort((a, b) => parseDateForSort(a) - parseDateForSort(b));
  }, [examList, manualExamList]);

  return {
    studentId,
    setStudentId,
    status,
    error,
    sortedExams,
    unlistedInfo,
    searchTriggered,
    handleSearch,
    handleSaveManualExam,
    handleDeleteManualExam
  };
};
