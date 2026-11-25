import { useState, useContext, useMemo } from 'react';
import {
  ClipboardCheck, AlertCircle, CheckCircle2, Plus, Search,
  LayoutGrid, List, Upload, RefreshCw
} from 'lucide-react';
import { t } from '../utils/i18n';
import { getCookieConsent } from '../utils/cookieConsent';
import { classifyExamKind, resolveExamIsoDate } from '../utils/courseEndDate';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { ToastContext } from '../contexts/ToastContext';

import { useExamRoom } from '../features/exams/useExamRoom';
import ExamSearchForm from '../features/exams/ExamSearchForm';
import ExamCard from '../features/exams/ExamCard';
import ExamManualModal from '../features/exams/ExamManualModal';
import ExamUnlistedAlert from '../features/exams/ExamUnlistedAlert';
import RegImportModal from '../components/RegImportModal';
import PageHeader from '../components/PageHeader';
import { EXAM_CONFIG } from '../config/exam';

function getTodayLocalIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function ExamRoom() {
  const { profile } = useAuth();
  const { lang } = useSettings();
  const toast = useContext(ToastContext);
  const isTh = lang === 'th';

  const activeEmail = (profile.email || '').toLowerCase().trim();

  const {
    studentId,
    setStudentId,
    searchedStudentId,
    isViewingOtherStudentId,
    status,
    error,
    sortedExams,
    rawSciBaseExams,
    sciBaseMeta,
    unlistedInfo,
    searchTriggered,
    isOutdatedData,
    isSciBaseOutdatedFallback,
    mergeStats,
    handleSearch,
    resetToOwnStudentId,
    handleSaveManualExam,
    handleDeleteManualExam,
    refreshFromCache
  } = useExamRoom(activeEmail, lang, profile.studentId);

  const loading = status === 'loading';
  const hasValidStudentId = /^\d{13}$/.test(String(studentId || '').replace(/[\s-]/g, '').trim());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegImportOpen, setIsRegImportOpen] = useState(false);
  const [editingExamData, setEditingExamData] = useState(null);
  const [userRoundTab, setUserRoundTab] = useState(null); // null -> smart auto-select
  const [showRawSciBase, setShowRawSciBase] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(() => {
    return !(sortedExams && sortedExams.length > 0) && !hasValidStudentId;
  });
  const [layoutView, setLayoutView] = useState(() => localStorage.getItem('classroom_hub_exam_layout') || 'grid');

  // Split exams into Midterm / Final buckets for clean tabs on the Exam Room page only
  const { midtermExams, finalExams, hasRoundSplit, defaultRoundTab } = useMemo(() => {
    const mid = [];
    const fin = [];
    const todayIso = getTodayLocalIso();

    for (const ex of sortedExams) {
      const kind = classifyExamKind(ex);
      if (kind === 'midterm') mid.push(ex);
      else if (kind === 'final') fin.push(ex);
    }

    const split = mid.length > 0 || fin.length > 0;
    let defTab = 'all';
    if (split) {
      const hasUpcomingMidterm = mid.some((ex) => {
        const iso = resolveExamIsoDate(ex);
        return !iso || iso >= todayIso;
      });
      if (mid.length > 0 && hasUpcomingMidterm) {
        defTab = 'midterm';
      } else if (fin.length > 0) {
        defTab = 'final';
      } else {
        defTab = 'midterm';
      }
    }

    return {
      midtermExams: mid,
      finalExams: fin,
      hasRoundSplit: split,
      defaultRoundTab: defTab,
    };
  }, [sortedExams]);

  const activeRoundTab = useMemo(() => {
    if (!hasRoundSplit) return 'all';
    if (userRoundTab === 'midterm' && midtermExams.length > 0) return 'midterm';
    if (userRoundTab === 'final' && finalExams.length > 0) return 'final';
    if (userRoundTab === 'all') return 'all';
    return defaultRoundTab;
  }, [hasRoundSplit, userRoundTab, midtermExams.length, finalExams.length, defaultRoundTab]);

  const viewingRawSciBase = Boolean(showRawSciBase && isSciBaseOutdatedFallback && rawSciBaseExams.length > 0);

  const displayedExams = useMemo(() => {
    if (viewingRawSciBase) return rawSciBaseExams;
    if (activeRoundTab === 'midterm') return midtermExams;
    if (activeRoundTab === 'final') return finalExams;
    return sortedExams;
  }, [viewingRawSciBase, rawSciBaseExams, activeRoundTab, midtermExams, finalExams, sortedExams]);

  const sciBaseTermSummary = useMemo(() => {
    const parts = [];
    if (sciBaseMeta?.examType === 'midterm') parts.push(isTh ? 'สอบกลางภาค' : 'Midterm');
    else if (sciBaseMeta?.examType === 'final') parts.push(isTh ? 'สอบปลายภาค' : 'Final');
    if (sciBaseMeta?.termLabel) parts.push(sciBaseMeta.termLabel);
    return parts.join(' ');
  }, [sciBaseMeta, isTh]);

  const isActiveTabSciBasePrimary = useMemo(() => {
    if (mergeStats?.mode !== 'scibase-primary') return false;
    const covered = mergeStats.coveredRounds || [];
    if (covered.includes('all')) return true;
    if (activeRoundTab === 'all') return covered.length > 0;
    return covered.includes(activeRoundTab);
  }, [mergeStats, activeRoundTab]);

  const isActiveTabRegFallback = useMemo(() => {
    if (mergeStats?.mode === 'reg-fallback') return true;
    if (mergeStats?.mode === 'scibase-primary') {
      const fallbackRounds = mergeStats.fallbackRegRounds || [];
      return activeRoundTab !== 'all' && fallbackRounds.includes(activeRoundTab);
    }
    return false;
  }, [mergeStats, activeRoundTab]);

  const toggleLayout = (view) => {
    setLayoutView(view);
    const consent = getCookieConsent();
    if (!consent || consent.preferences !== false) {
      localStorage.setItem('classroom_hub_exam_layout', view);
    }
  };

  const openNewModal = () => {
    setEditingExamData(null);
    setIsModalOpen(true);
  };

  const openEditModal = (exam) => {
    setEditingExamData(exam);
    setIsModalOpen(true);
  };

  const onSaveModal = (examData) => {
    handleSaveManualExam(examData);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('examRoom', lang)}
        description={t('examDesc', lang)}
        icon={ClipboardCheck}
        actions={
          <>
            {hasValidStudentId && EXAM_CONFIG.seatingLookupEnabled && (
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={loading}
                className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] px-3 h-9 rounded-lg text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] font-medium transition-colors cursor-pointer disabled:opacity-50"
                title={isTh ? 'เช็กที่นั่งสอบล่าสุดจากเว็บ มจพ.' : 'Re-check official seating by Student ID'}
              >
                <RefreshCw size={15} strokeWidth={1.5} className={`text-[var(--primary-bright)] ${loading ? 'animate-spin' : ''}`} />
                <span>{isTh ? 'เช็กที่นั่งสอบ' : 'Check Seating'}</span>
              </button>
            )}
            {!isSearchVisible && EXAM_CONFIG.seatingLookupEnabled && (
              <button
                type="button"
                onClick={() => setIsSearchVisible(true)}
                className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] px-3 h-9 rounded-lg text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] font-medium transition-colors cursor-pointer"
              >
                <Search size={15} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
                <span>{isTh ? 'ค้นหารหัสอื่น' : 'Other ID'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsRegImportOpen(true)}
              className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] px-3 h-9 rounded-lg text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] font-medium transition-colors cursor-pointer"
            >
              <Upload size={15} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
              <span>{t('importReg', lang)}</span>
            </button>
            <button
              type="button"
              onClick={openNewModal}
              className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-xs px-4 h-9 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition-colors cursor-pointer"
            >
              <Plus size={15} strokeWidth={1.5} />
              <span>{t('addExamBtn', lang)}</span>
            </button>
          </>
        }
      />

      {EXAM_CONFIG.seatingLookupEnabled ? (
        EXAM_CONFIG.seatingLookupUsesHttp && (
          <div role="status" className="bg-amber-500/8 border border-amber-500/25 text-amber-200 text-xs px-4 py-3 rounded-xl flex items-start gap-2.5">
            <AlertCircle size={16} strokeWidth={1.5} className="shrink-0 mt-0.5 text-amber-300" />
            <p className="leading-relaxed">{t('examLookupWarning', lang)}</p>
          </div>
        )
      ) : (
        <div role="status" className="bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] text-xs px-4 py-3 rounded-xl flex items-start gap-2.5">
          <AlertCircle size={16} strokeWidth={1.5} className="shrink-0 mt-0.5 text-[var(--primary-bright)]" />
          <p className="leading-relaxed">{t('examLookupUnavailable', lang)}</p>
        </div>
      )}

      {/* Security Notice & Search Form */}
      {isSearchVisible && EXAM_CONFIG.seatingLookupEnabled && (
        <div className="space-y-4">
          <ExamSearchForm
            studentId={studentId}
            setStudentId={setStudentId}
            onSearch={(e) => handleSearch(e)}
            loading={loading}
            lang={lang}
          />
        </div>
      )}

      {/* Error Message (non-blocking if Reg fallback exams exist) */}
      {error && !loading && (
        <div className="bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs px-4 py-3 rounded-xl flex items-start gap-2.5">
          <AlertCircle size={16} strokeWidth={1.5} className="shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            {sortedExams.length > 0
              ? (isTh
                  ? `เชื่อมต่อเว็บเช็กที่นั่งสอบไม่ได้ (${error}) — แสดงตารางสอบจาก Reg แทน`
                  : `Could not reach official seating site (${error}) — showing Reg exam schedule instead.`)
              : error}
          </span>
        </div>
      )}

      {/* SciBase-First Loading State (checks official seating site BEFORE displaying Reg fallback) */}
      {loading && (
        <div className="py-12 text-center space-y-3 max-w-2xl mx-auto">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--border)] border-t-[var(--primary)] animate-spin mx-auto" />
          <p className="text-xs text-[var(--text-primary)] font-medium">
            {isTh
              ? 'กำลังตรวจสอบตารางที่นั่งสอบทางการจากรหัสนักศึกษาก่อน...'
              : 'Checking official exam seating database by Student ID first...'}
          </p>
        </div>
      )}

      {/* Resolved Results (shown after SciBase-first check completes) */}
      {((studentId.trim() !== '' && searchTriggered) || sortedExams.length > 0 || unlistedInfo) && !loading && (
        <div className="space-y-4">
          {isOutdatedData && (
            <div className="bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium px-4 py-3 rounded-xl flex items-start gap-2.5">
              <AlertCircle size={16} strokeWidth={1.5} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {lang === 'en'
                  ? 'The system currently shows exam schedules from the previous semester. It seems the university has not updated the exam database for the new semester yet.'
                  : 'ข้อมูลตารางสอบที่แสดงผลอาจเป็นของภาคการศึกษาที่แล้ว เนื่องจากฐานข้อมูลของมหาวิทยาลัยยังไม่มีการอัปเดตข้อมูลสำหรับภาคการศึกษาใหม่'}
              </p>
            </div>
          )}

          {/* Viewing another Student ID banner */}
          {isViewingOtherStudentId && (
            <div className="bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text-primary)] text-xs px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <span className="leading-relaxed">
                {isTh
                  ? `กำลังดูที่นั่งสอบจาก SciBase ของรหัส ${searchedStudentId} (ไม่บันทึกทับตารางของคุณ)`
                  : `Viewing SciBase seating for Student ID ${searchedStudentId} (does not overwrite your schedule)`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowRawSciBase(false);
                  resetToOwnStudentId();
                }}
                className="text-[var(--primary-bright)] hover:bg-[var(--surface-hover)] px-2.5 py-1 rounded-lg font-medium cursor-pointer shrink-0 whitespace-nowrap transition-colors"
              >
                {isTh ? 'กลับไปดูของฉัน' : 'Back to my ID'}
              </button>
            </div>
          )}

          {/* Source Status Banner */}
          {!isViewingOtherStudentId && sortedExams.length > 0 && isActiveTabSciBasePrimary && (
            <div className="bg-emerald-500/8 border border-emerald-500/25 text-emerald-300 text-xs px-4 py-3 rounded-xl flex items-center gap-2.5">
              <CheckCircle2 size={16} strokeWidth={1.5} className="shrink-0" />
              <span className="leading-relaxed">
                {isTh
                  ? `ใช้ตารางที่นั่งสอบทางการจากเว็บ มจพ. เป็นหลัก (${displayedExams.length} รายการ)`
                  : `Using official Student ID seating schedule as primary source (${displayedExams.length} exams)`}
              </span>
            </div>
          )}

          {!isViewingOtherStudentId && sortedExams.length > 0 && !isActiveTabSciBasePrimary && isActiveTabRegFallback && (
            <div className="bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} strokeWidth={1.5} className="text-[var(--primary-bright)] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  {isSciBaseOutdatedFallback
                    ? (isTh
                        ? `เช็กเว็บที่นั่งสอบแล้ว (${searchedStudentId || studentId}) — ล่าสุดยังเป็น${sciBaseTermSummary ? ` ${sciBaseTermSummary}` : 'ของเทอมก่อน'} (${rawSciBaseExams.length} วิชา) จึงแสดงตารางสอบเทอมปัจจุบันจาก KMUTNB Reg แทนชั่วคราว`
                        : `Checked SciBase (${searchedStudentId || studentId}) — latest data is still ${sciBaseTermSummary || 'previous semester'} (${rawSciBaseExams.length} exams), so displaying your current KMUTNB Reg schedule instead.`)
                    : (isTh
                        ? 'รอบสอบนี้ยังไม่ประกาศที่นั่งสอบในเว็บ SciBase — แสดงวันสอบจาก KMUTNB Reg แทนชั่วคราว (รอประกาศห้องสอบ)'
                        : 'Official seating for this round is not published yet — displaying KMUTNB Reg exam dates (Room TBA).')}
                </p>
              </div>
              {isSciBaseOutdatedFallback && rawSciBaseExams.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRawSciBase((prev) => !prev)}
                  className="text-[11px] font-medium text-[var(--primary-bright)] bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 self-end sm:self-center cursor-pointer"
                >
                  {viewingRawSciBase
                    ? (isTh ? 'กลับไปดูตารางเทอมปัจจุบัน' : 'Back to current term')
                    : (isTh ? `ดูข้อมูล SciBase (${rawSciBaseExams.length})` : `View SciBase (${rawSciBaseExams.length})`)}
                </button>
              )}
            </div>
          )}

          {sortedExams.length > 0 && (
            <div className="space-y-4">
              {/* Midterm / Final Segmented Tabs + Layout Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {hasRoundSplit && !viewingRawSciBase ? (
                  <div
                    role="tablist"
                    aria-label={isTh ? 'เลือกรอบสอบ' : 'Exam round'}
                    className="inline-flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1 gap-1 self-start"
                  >
                    {midtermExams.length > 0 && (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeRoundTab === 'midterm'}
                        onClick={() => setUserRoundTab('midterm')}
                        className={`px-3 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                          activeRoundTab === 'midterm'
                            ? 'bg-[var(--primary)] text-white'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                        }`}
                      >
                        <span>{isTh ? 'กลางภาค' : 'Midterm'}</span>
                        <span className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                          activeRoundTab === 'midterm' ? 'bg-white/15 text-white' : 'bg-[var(--app-bg)] text-[var(--text-muted)]'
                        }`}>
                          {midtermExams.length}
                        </span>
                      </button>
                    )}
                    {finalExams.length > 0 && (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeRoundTab === 'final'}
                        onClick={() => setUserRoundTab('final')}
                        className={`px-3 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                          activeRoundTab === 'final'
                            ? 'bg-[var(--primary)] text-white'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                        }`}
                      >
                        <span>{isTh ? 'ปลายภาค' : 'Final'}</span>
                        <span className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                          activeRoundTab === 'final' ? 'bg-white/15 text-white' : 'bg-[var(--app-bg)] text-[var(--text-muted)]'
                        }`}>
                          {finalExams.length}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeRoundTab === 'all'}
                      onClick={() => setUserRoundTab('all')}
                      className={`px-3 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                        activeRoundTab === 'all'
                          ? 'bg-[var(--primary)] text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                      }`}
                    >
                      <span>{isTh ? 'ทั้งหมด' : 'All'}</span>
                      <span className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                        activeRoundTab === 'all' ? 'bg-white/15 text-white' : 'bg-[var(--app-bg)] text-[var(--text-muted)]'
                      }`}>
                        {sortedExams.length}
                      </span>
                    </button>
                  </div>
                ) : (
                  <h3 className="font-medium text-xs text-[var(--text-heading)] flex items-center gap-2">
                    <CheckCircle2 size={15} strokeWidth={1.5} className="text-emerald-400" />
                    <span>{lang === 'en' ? 'Your Exam Seating Schedule' : 'ตารางและที่นั่งสอบของคุณ'}</span>
                  </h3>
                )}

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => toggleLayout('grid')}
                      className={`p-1.5 rounded transition-colors cursor-pointer ${
                        layoutView === 'grid' ? 'bg-[var(--surface-elevated)] text-[var(--primary-bright)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      title={lang === 'en' ? 'Grid View' : 'มุมมองแบบกริด'}
                    >
                      <LayoutGrid size={15} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleLayout('list')}
                      className={`p-1.5 rounded transition-colors cursor-pointer ${
                        layoutView === 'list' ? 'bg-[var(--surface-elevated)] text-[var(--primary-bright)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      title={lang === 'en' ? 'List View' : 'มุมมองแบบรายการ'}
                    >
                      <List size={15} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>

              <div className={layoutView === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'flex flex-col gap-3'}>
                {displayedExams.map((exam, index) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    index={index}
                    lang={lang}
                    onEdit={openEditModal}
                    onDelete={handleDeleteManualExam}
                    layout={layoutView}
                  />
                ))}
              </div>
            </div>
          )}

          {sortedExams.length === 0 && !unlistedInfo && !error && (
            <div className="bg-[var(--surface)] border border-[var(--border)] border-dashed rounded-xl p-10 text-center max-w-2xl mx-auto">
              <ClipboardCheck size={24} strokeWidth={1.5} className="text-[var(--text-muted)] mx-auto mb-3" />
              <h3 className="font-medium text-[var(--text-heading)] text-base mb-1.5">{t('noUpcomingExams', lang)}</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {lang === 'en'
                  ? 'There are no upcoming exams found in the database. If you have custom exam schedules, you can add them manually.'
                  : 'ไม่พบรายชื่อการสอบที่กำลังจะมาถึงในระบบ คุณสามารถเพิ่มวิชาสอบของคุณเองได้โดยใช้ปุ่มเพิ่มวิชาสอบด้านบน'}
              </p>
            </div>
          )}

          <ExamUnlistedAlert unlistedInfo={unlistedInfo} lang={lang} />
        </div>
      )}

      {isModalOpen && (
        <ExamManualModal
          isOpen={isModalOpen}
          initialData={editingExamData}
          onSave={onSaveModal}
          onCancel={() => setIsModalOpen(false)}
          lang={lang}
          key={editingExamData?.id || 'new'}
        />
      )}

      {isRegImportOpen && (
        <RegImportModal
          isOpen={isRegImportOpen}
          defaultFocus="schedule"
          lang={lang}
          onClose={() => setIsRegImportOpen(false)}
          onImported={(parsed) => {
            refreshFromCache();
            if (parsed.meta.totalExams > 0) {
              setIsSearchVisible(false);
            }
            toast?.addToast?.(
              isTh
                ? `นำเข้าวันสอบ ${parsed.meta.totalExams} รายการจาก KMUTNB Reg แล้ว`
                : `Imported ${parsed.meta.totalExams} exams from KMUTNB Reg`,
              'success'
            );
          }}
        />
      )}
    </div>
  );
}
