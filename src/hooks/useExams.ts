import { useState, useEffect, useRef } from 'react';
import { examRepository } from '../repositories/examRepository';
import { syncManager } from '../services/SyncManager';
import { calendarSyncManager } from '../services/CalendarSyncManager';
import { getToken } from '../utils/storage';
import { Exam, UnlistedExamInfo } from '../types/models';

interface ExamState {
  allExams: Exam[];
  hasCheckedExams: boolean;
  unlistedInfo: UnlistedExamInfo | null;
}

const resolveStudentId = (activeEmail: string, studentIdHint?: string): string | null => {
  const cleanHint = String(studentIdHint || '').replace(/[\s-]/g, '');
  if (/^\d{13}$/.test(cleanHint)) return cleanHint;
  const emailMatch = activeEmail?.match(/\d{13}/);
  return emailMatch ? emailMatch[0] : null;
};

export function useExams(activeEmail: string, lang: string, scheduleDeps: unknown[], studentIdHint = '') {
  const implicitStudentId = resolveStudentId(activeEmail, studentIdHint);

  const initialCacheSnapshot = (() => {
    let initialExams: Exam[] = [];
    let initialChecked = false;
    let initialUnlisted: UnlistedExamInfo | null = null;
    let initialHasRemote = false;

    if (activeEmail) {
      const cachedResult = examRepository.getCachedExams(activeEmail);
      const data = (cachedResult.success && cachedResult.data) ? cachedResult.data : null;

      if (data) {
        const hasCachedExams = Boolean(data.exams && data.exams.length > 0);
        const hasUnlisted = Boolean(data.unlisted);
        const hasManual = Boolean(data.manualExams && data.manualExams.length > 0);
        initialHasRemote = hasCachedExams || hasUnlisted;

        if (initialHasRemote || (hasManual && !implicitStudentId)) {
          initialChecked = true;
        }
        initialUnlisted = data.unlisted || null;
        initialExams = [...(data.exams || []), ...(data.manualExams || [])];
      }
    }

    return {
      state: { allExams: initialExams, hasCheckedExams: initialChecked, unlistedInfo: initialUnlisted },
      hasRemote: initialHasRemote
    };
  })();

  const [examState, setExamState] = useState<ExamState>(initialCacheSnapshot.state);
  const [examEventTick, setExamEventTick] = useState(0);

  useEffect(() => {
    const onExamsUpdated = () => setExamEventTick(v => v + 1);
    window.addEventListener('classroom_hub_exams_updated', onExamsUpdated);
    return () => window.removeEventListener('classroom_hub_exams_updated', onExamsUpdated);
  }, []);

  const fetchAttempted = useRef(false);
  const completedFetchKeyRef = useRef<string | null>(null);
  const hadRemoteCacheRef = useRef(initialCacheSnapshot.hasRemote);
  const lastScopeKeyRef = useRef(`${activeEmail}::${implicitStudentId || ''}`);

  const [isFetching, setIsFetching] = useState(() => {
    return !examState.hasCheckedExams && !!implicitStudentId;
  });

  // Reset / resync exam cache on activeEmail or studentId changes and when ClassroomContext finishes a Drive sync
  useEffect(() => {
    const scopeKey = `${activeEmail}::${implicitStudentId || ''}`;
    const scopeChanged = scopeKey !== lastScopeKeyRef.current;
    if (scopeChanged) {
      lastScopeKeyRef.current = scopeKey;
      fetchAttempted.current = false;
      completedFetchKeyRef.current = null;
      hadRemoteCacheRef.current = false;
    }

    if (!activeEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExamState({ allExams: [], hasCheckedExams: false, unlistedInfo: null });
      hadRemoteCacheRef.current = false;
      setIsFetching(false);
      return;
    }

    const cachedResult = examRepository.getCachedExams(activeEmail);
    const data = (cachedResult.success && cachedResult.data) ? cachedResult.data : null;

    if (data) {
      const hasCachedExams = Boolean(data.exams && data.exams.length > 0);
      const hasUnlisted = Boolean(data.unlisted);
      const hasRemoteCache = hasCachedExams || hasUnlisted;
      const hasManual = Boolean(data.manualExams && data.manualExams.length > 0);
      const newExams = [...(data.exams || []), ...(data.manualExams || [])];

      if (hasRemoteCache) {
        hadRemoteCacheRef.current = true;
        fetchAttempted.current = true;
        completedFetchKeyRef.current = scopeKey;
        setIsFetching(false);
        setExamState(prev => {
          if (scopeChanged || JSON.stringify(prev.allExams) !== JSON.stringify(newExams) || !prev.hasCheckedExams) {
            return { allExams: newExams, hasCheckedExams: true, unlistedInfo: data.unlisted || null };
          }
          return prev;
        });
        return;
      }

      // If cached remote exams expired mid-session, reset fetch guards so fresh exams can re-fetch
      if (hadRemoteCacheRef.current && implicitStudentId) {
        hadRemoteCacheRef.current = false;
        fetchAttempted.current = false;
        completedFetchKeyRef.current = null;
        setExamState({ allExams: data.manualExams || [], hasCheckedExams: false, unlistedInfo: null });
        return;
      }

      if (hasManual) {
        setExamState(prev => {
          const shouldBeChecked = !implicitStudentId ? true : prev.hasCheckedExams;
          if (scopeChanged || JSON.stringify(prev.allExams) !== JSON.stringify(newExams) || prev.hasCheckedExams !== shouldBeChecked) {
            return { allExams: newExams, hasCheckedExams: shouldBeChecked, unlistedInfo: null };
          }
          return prev;
        });
        return;
      }
    }

    if (scopeChanged) {
      setExamState({ allExams: [], hasCheckedExams: false, unlistedInfo: null });
    }
  }, [activeEmail, implicitStudentId, scheduleDeps, examEventTick]);

  useEffect(() => {
    const fetchKey = `${activeEmail}::${implicitStudentId || ''}`;
    if (activeEmail && implicitStudentId && !examState.hasCheckedExams && !fetchAttempted.current && completedFetchKeyRef.current !== fetchKey) {
      const controller = new AbortController();
      let settled = false;
      fetchAttempted.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsFetching(true);
      examRepository.fetchExams(implicitStudentId, lang, controller.signal).then(result => {
        if (controller.signal.aborted) return;
        settled = true;
        completedFetchKeyRef.current = fetchKey;
        if (result.success && ((result.data.exams && result.data.exams.length > 0) || result.data.unlisted)) {
          hadRemoteCacheRef.current = true;
          const currentCache = examRepository.getCachedExams(activeEmail);
          const currentManual = (currentCache.success && currentCache.data) ? (currentCache.data.manualExams || []) : [];
          examRepository.saveToCache(activeEmail, result.data.exams || [], currentManual, result.data.unlisted);
          sessionStorage.setItem('lastExamSearch', implicitStudentId);
          
          const token = getToken();
          if (token && activeEmail) {
            syncManager.queueSync(token, activeEmail);
            calendarSyncManager.queueSync(token, activeEmail);
          }
          
          setExamState({
            allExams: [...(result.data.exams || []), ...currentManual],
            hasCheckedExams: true,
            unlistedInfo: result.data.unlisted
          });
        } else {
          setExamState(prev => ({ ...prev, hasCheckedExams: true }));
        }
      }).catch((err) => {
        if (err.name === 'AbortError' || controller.signal.aborted) return;
        settled = true;
        completedFetchKeyRef.current = fetchKey;
        setExamState(prev => ({ ...prev, hasCheckedExams: true }));
      }).finally(() => {
        if (controller.signal.aborted) return;
        setIsFetching(false);
      });

      return () => {
        controller.abort();
        // Reset fetchAttempted if aborted before completion (e.g. React StrictMode remount)
        if (!settled) {
          fetchAttempted.current = false;
        }
      };
    }
  }, [activeEmail, implicitStudentId, examState.hasCheckedExams, lang]);

  return {
    allExams: examState.allExams,
    hasCheckedExams: examState.hasCheckedExams,
    unlistedInfo: examState.unlistedInfo,
    isFetching
  };
}
