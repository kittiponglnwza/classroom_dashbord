import { useState, useContext } from 'react';
import { ClipboardCheck, Lock, AlertCircle, CheckCircle2, Plus, Search, LayoutGrid, List, Upload } from 'lucide-react';
import { t } from '../utils/i18n';
import { getCookieConsent } from '../utils/cookieConsent';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { ToastContext } from '../contexts/ToastContext';

import { useExamRoom } from '../features/exams/useExamRoom';
import ExamSearchForm from '../features/exams/ExamSearchForm';
import ExamCard from '../features/exams/ExamCard';
import ExamManualModal from '../features/exams/ExamManualModal';
import ExamUnlistedAlert from '../features/exams/ExamUnlistedAlert';
import RegImportModal from '../components/RegImportModal';

export default function ExamRoom() {
  const { profile } = useAuth();
  const { lang } = useSettings();
  const toast = useContext(ToastContext);

  const activeEmail = (profile.email || '').toLowerCase().trim();

  const {
    studentId,
    setStudentId,
    status,
    error,
    sortedExams,
    unlistedInfo,
    searchTriggered,
    isOutdatedData,
    handleSearch,
    handleSaveManualExam,
    handleDeleteManualExam,
    refreshFromCache
  } = useExamRoom(activeEmail, lang, profile.studentId);

  const loading = status === 'loading';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegImportOpen, setIsRegImportOpen] = useState(false);
  const [editingExamData, setEditingExamData] = useState(null);
  const [isSearchVisible, setIsSearchVisible] = useState(() => {
    return !(sortedExams && sortedExams.length > 0);
  });
  const [layoutView, setLayoutView] = useState(() => localStorage.getItem('classroom_hub_exam_layout') || 'grid');

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="border-b border-[#3C3C3C] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#FFFFFF] flex items-center gap-2.5 tracking-tight">
            <ClipboardCheck size={22} className="text-[#3794FF]" />
            <span>{t('examTitle', lang)}</span>
          </h1>
          <p className="text-xs text-[#9D9D9D] mt-1 leading-relaxed">{t('examDesc', lang)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {!isSearchVisible && (
            <button
              type="button"
              onClick={() => setIsSearchVisible(true)}
              className="flex items-center gap-1.5 bg-[#252526] border border-[#3C3C3C] px-3.5 py-2.5 rounded-xl text-xs text-[#D4D4D4] hover:bg-[#2A2D2E] font-medium transition-colors cursor-pointer"
            >
              <Search size={14} className="text-[#3794FF]" />
              <span>{lang === 'en' ? 'Search Student ID' : 'ค้นหารหัสนักศึกษา'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsRegImportOpen(true)}
            className="flex items-center gap-1.5 bg-[#252526] border border-[#3C3C3C] px-3.5 py-2.5 rounded-xl text-xs text-[#D4D4D4] hover:bg-[#2A2D2E] font-medium transition-colors cursor-pointer"
          >
            <Upload size={14} className="text-[#3794FF]" />
            <span>{t('importReg', lang)}</span>
          </button>
          <button
            type="button"
            onClick={openNewModal}
            className="flex items-center gap-1.5 bg-[#007ACC] hover:bg-[#1177BB] text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>{t('addExamBtn', lang)}</span>
          </button>
        </div>
      </div>

      {/* Security Notice */}
      {isSearchVisible && (
        <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-4 flex items-start gap-3 text-xs max-w-2xl text-[#9D9D9D] leading-relaxed">
          <Lock size={15} className="text-[#3794FF] shrink-0 mt-0.5" />
          <p>{t('securityWarning', lang)}</p>
        </div>
      )}

      {/* Search Form Component */}
      {isSearchVisible && (
        <ExamSearchForm
          studentId={studentId}
          setStudentId={setStudentId}
          onSearch={(e) => handleSearch(e)}
          loading={loading}
          lang={lang}
        />
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2 max-w-2xl">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Widget */}
      {loading && (
        <div className="py-14 text-center space-y-3 max-w-2xl">
          <div className="w-6 h-6 rounded-full border-2 border-[#3C3C3C] border-t-[#007ACC] animate-spin mx-auto" />
          <p className="text-xs text-[#9D9D9D] font-medium">{t('fetchingExam', lang)}</p>
        </div>
      )}

      {/* Search Results */}
      {((studentId.trim() !== '' && searchTriggered) || sortedExams.length > 0 || unlistedInfo) && !loading && (
        <div className="space-y-6">
          {isOutdatedData && (
            <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium p-4 rounded-2xl flex items-start gap-3">
              <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {lang === 'en'
                  ? 'The system currently shows exam schedules from the previous semester. It seems the university has not updated the exam database for the new semester yet.'
                  : 'ข้อมูลตารางสอบที่แสดงผลอาจเป็นของภาคการศึกษาที่แล้ว เนื่องจากฐานข้อมูลของมหาวิทยาลัยยังไม่มีการอัปเดตข้อมูลสำหรับภาคการศึกษาใหม่'}
              </p>
            </div>
          )}

          {sortedExams.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-semibold text-xs text-[#FFFFFF] flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>{lang === 'en' ? 'Your Exam Seating Schedule' : 'ตารางและที่นั่งสอบของคุณ'}</span>
                </h3>

                <div className="flex items-center gap-2.5">
                  <div className="flex items-center bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => toggleLayout('grid')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        layoutView === 'grid' ? 'bg-[#094771]/70 text-[#3794FF]' : 'text-[#858585] hover:text-[#D4D4D4]'
                      }`}
                      title={lang === 'en' ? 'Grid View' : 'มุมมองแบบกริด'}
                    >
                      <LayoutGrid size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleLayout('list')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        layoutView === 'list' ? 'bg-[#094771]/70 text-[#3794FF]' : 'text-[#858585] hover:text-[#D4D4D4]'
                      }`}
                      title={lang === 'en' ? 'List View' : 'มุมมองแบบรายการ'}
                    >
                      <List size={14} />
                    </button>
                  </div>

                  {!isSearchVisible && (
                    <button
                      type="button"
                      onClick={() => setIsSearchVisible(true)}
                      className="text-xs bg-[#252526] border border-[#3C3C3C] px-3 py-1.5 rounded-xl text-[#D4D4D4] hover:bg-[#2A2D2E] font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Search size={12} className="text-[#3794FF]" />
                      <span>{lang === 'en' ? 'Search Another ID' : 'ค้นหารหัสอื่น'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className={layoutView === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'flex flex-col gap-3'}>
                {sortedExams.map((exam, index) => (
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
            <div className="bg-[#252526] border border-[#3C3C3C] border-dashed rounded-2xl p-10 text-center max-w-2xl mx-auto">
              <ClipboardCheck size={32} className="text-[#858585] mx-auto mb-3 opacity-60" />
              <h3 className="font-semibold text-[#FFFFFF] text-base mb-1.5">{t('noUpcomingExams', lang)}</h3>
              <p className="text-xs text-[#9D9D9D] leading-relaxed">
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
              lang === 'th'
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
