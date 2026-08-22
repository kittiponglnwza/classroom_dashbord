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

export function useExams(activeEmail: string, lang: string, scheduleDeps: any) {
  const implicitStudentId = activeEmail?.match(/\d{13}/) ? activeEmail.match(/\d{13}/)![0] : null;

  const [examState, setExamState] = useState<ExamState>(() => {
    let initialExams: Exam[] = [];
    let initialChecked = false;
    let initialUnlisted: UnlistedExamInfo | null = null;

    if (activeEmail) {
      const savedSearch = sessionStorage.getItem('lastExamSearch') || implicitStudentId;
      const cachedResult = examRepository.getCachedExams(activeEmail);
      const data = (cachedResult.success && cachedResult.data) ? cachedResult.data : null;

      if (data) {
        const hasCachedExams = data.exams && data.exams.length > 0;
        const hasManual = data.manualExams && data.manualExams.length > 0;
        
        if (savedSearch || hasCachedExams || hasManual) {
          initialChecked = true;
          initialUnlisted = data.unlisted || null;
          const examsToLoad = (savedSearch || hasCachedExams) ? (data.exams || []) : [];
          initialExams = [...examsToLoad, ...(data.manualExams || [])];
        }
      }
    }
    
    return { allExams: initialExams, hasCheckedExams: initialChecked, unlistedInfo: initialUnlisted };
  });

  // Enforce exam cache sync on mount, activeEmail changes, and when ClassroomContext finishes a Drive sync
  useEffect(() => {
    if (activeEmail) {
      const savedSearch = sessionStorage.getItem('lastExamSearch') || implicitStudentId;
      const cachedResult = examRepository.getCachedExams(activeEmail);
      const data = (cachedResult.success && cachedResult.data) ? cachedResult.data : null;
      
      if (data) {
        const hasCachedExams = data.exams && data.exams.length > 0;
        const hasManual = data.manualExams && data.manualExams.length > 0;
        
        if (savedSearch || hasCachedExams || hasManual) {
          const examsToLoad = (savedSearch || hasCachedExams) ? (data.exams || []) : [];
          const newExams = [...examsToLoad, ...(data.manualExams || [])];
          
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setExamState(prev => {
            if (JSON.stringify(prev.allExams) !== JSON.stringify(newExams)) {
              return { allExams: newExams, hasCheckedExams: true, unlistedInfo: data.unlisted || null };
            }
            return prev;
          });
        }
      }
    }
  }, [activeEmail, implicitStudentId, scheduleDeps]);

  const fetchAttempted = useRef(false);
  const [isFetching, setIsFetching] = useState(() => {
    return !examState.hasCheckedExams && !!implicitStudentId;
  });

  useEffect(() => {
    if (activeEmail && implicitStudentId && !examState.hasCheckedExams && !fetchAttempted.current) {
      fetchAttempted.current = true;
      setIsFetching(true);
      examRepository.fetchExams(implicitStudentId, lang).then(result => {
        if (result.success && result.data.exams && result.data.exams.length > 0) {
          const currentCache = examRepository.getCachedExams(activeEmail);
          const currentManual = (currentCache.success && currentCache.data) ? (currentCache.data.manualExams || []) : [];
          examRepository.saveToCache(activeEmail, result.data.exams, currentManual, result.data.unlisted);
          sessionStorage.setItem('lastExamSearch', implicitStudentId);
          
          const token = getToken();
          if (token && activeEmail) {
            syncManager.queueSync(token, activeEmail);
            calendarSyncManager.queueSync(token, activeEmail);
          }
          
          setExamState({
            allExams: [...result.data.exams, ...currentManual],
            hasCheckedExams: true,
            unlistedInfo: result.data.unlisted
          });
        } else {
          setExamState(prev => ({ ...prev, hasCheckedExams: true }));
        }
      }).catch(() => {
        setExamState(prev => ({ ...prev, hasCheckedExams: true }));
      }).finally(() => {
        setIsFetching(false);
      });
    }
  }, [activeEmail, implicitStudentId, examState.hasCheckedExams, lang]);

  return {
    allExams: examState.allExams,
    hasCheckedExams: examState.hasCheckedExams,
    unlistedInfo: examState.unlistedInfo,
    isFetching
  };
}
