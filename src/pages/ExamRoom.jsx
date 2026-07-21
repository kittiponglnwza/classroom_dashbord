import { useState } from 'react';
import { ClipboardCheck, Lock, AlertCircle, CheckCircle2, Plus, Search } from 'lucide-react';
import { t } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

import { useExamRoom } from '../features/exams/useExamRoom';
import ExamSearchForm from '../features/exams/ExamSearchForm';
import ExamCard from '../features/exams/ExamCard';
import ExamManualModal from '../features/exams/ExamManualModal';
import ExamUnlistedAlert from '../features/exams/ExamUnlistedAlert';

export default function ExamRoom() {
  const { profile } = useAuth();
  const { lang } = useSettings();
  
  const activeEmail = (profile.email || '').toLowerCase().trim();

  // Custom hook manages ALL business logic and state
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
    handleDeleteManualExam
  } = useExamRoom(activeEmail, lang);

  const loading = status === 'loading';

  // Local UI State for Modal and Search Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExamData, setEditingExamData] = useState(null);
  const [isSearchVisible, setIsSearchVisible] = useState(() => {
    return !(sortedExams && sortedExams.length > 0);
  });

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
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in py-2 relative">
      {/* Abstract Background Elements */}
      <div className="fixed top-1/4 right-1/4 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>
      <div className="fixed bottom-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>

      {/* Page Header */}
      <div className="border-b border-white/5 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 opacity-0 animate-fade-in" style={{ animationDelay: '50ms' }}>
        <div>
          <h1 className="text-3xl font-bold font-heading text-white flex items-center gap-3 tracking-tight">
            <ClipboardCheck size={28} className="text-brand-400" />
            {t('examTitle', lang)}
          </h1>
          <p className="text-sm text-dark-muted mt-2 leading-relaxed">{t('examDesc', lang)}</p>
        </div>
        <button
          type="button"
          onClick={openNewModal}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-bold text-xs px-5 py-3 rounded-2xl transition-all duration-300 shadow-lg shadow-brand-500/20 cursor-pointer shrink-0 hover:-translate-y-0.5"
        >
          <Plus size={16} />
          {t('addExamBtn', lang)}
        </button>
      </div>

      {/* Security Warning Badge */}
      {isSearchVisible && (
        <div className="bg-amber-500/5 backdrop-blur-md border border-amber-500/20 rounded-2xl p-5 flex items-start gap-4 text-xs max-w-2xl text-amber-400/90 leading-relaxed shadow-lg opacity-0 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <Lock size={16} className="shrink-0 mt-0.5" />
          <p>{t('securityWarning', lang)}</p>
        </div>
      )}

      {/* Search Form Component */}
      {isSearchVisible && (
        <div className="opacity-0 animate-fade-in" style={{ animationDelay: '150ms' }}>
          <ExamSearchForm 
            studentId={studentId}
            setStudentId={setStudentId}
            onSearch={(e) => {
              handleSearch(e);
              // Hide search form after clicking search if it successfully fetched
              // We'll let the user see the result, but wait, maybe don't hide immediately
            }}
            loading={loading}
            lang={lang}
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in max-w-2xl">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Loading Widget */}
      {loading && (
        <div className="py-16 text-center space-y-4 max-w-2xl">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500/20 border-t-brand-400 animate-spin mx-auto" />
          <p className="text-xs text-dark-muted font-medium">{t('fetchingExam', lang)}</p>
        </div>
      )}

      {/* Search Results */}
      {((studentId.trim() !== "" && searchTriggered) || sortedExams.length > 0) && !loading && (
        <div className="space-y-8 animate-fade-in opacity-0" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
          
          {/* Outdated Data Warning */}
          {isOutdatedData && (
            <div className="bg-amber-500/10 backdrop-blur-md border border-amber-500/20 text-amber-400 text-sm font-medium p-6 rounded-3xl flex items-start gap-4 shadow-lg">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {lang === 'en' 
                  ? 'The system currently shows exam schedules from the previous semester. It seems the university has not updated the exam database for the new semester yet.' 
                  : 'ข้อมูลตารางสอบที่แสดงผลอาจเป็นของภาคการศึกษาที่แล้ว เนื่องจากฐานข้อมูลของมหาวิทยาลัยยังไม่มีการอัปเดตข้อมูลสำหรับภาคการศึกษาใหม่'}
              </p>
            </div>
          )}

          {/* Seating Cards Grid */}
          {sortedExams.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  {lang === 'en' ? 'Your Exam Seating Schedule' : 'ตารางและที่นั่งสอบของคุณ'}
                </h3>
                {!isSearchVisible && (
                  <button
                    type="button"
                    onClick={() => setIsSearchVisible(true)}
                    className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors flex items-center gap-1"
                  >
                    <Search size={12} />
                    {lang === 'en' ? 'Search Another ID' : 'ค้นหารหัสนักศึกษาอื่น'}
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedExams.map((exam, idx) => (
                  <ExamCard 
                    key={exam.id}
                    exam={exam}
                    index={idx}
                    lang={lang}
                    onEdit={openEditModal}
                    onDelete={handleDeleteManualExam}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No Upcoming Exams State */}
          {sortedExams.length === 0 && !unlistedInfo && (
            <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-10 text-center max-w-2xl shadow-2xl mx-auto">
              <ClipboardCheck size={36} className="text-zinc-500 mx-auto mb-4" />
              <h3 className="font-bold text-white text-lg mb-2">{t('noUpcomingExams', lang)}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {lang === 'en'
                  ? 'There are no upcoming exams found in the database. If you have custom exam schedules, you can add them manually.'
                  : 'ไม่พบรายชื่อการสอบที่กำลังจะมาถึงในระบบ คุณสามารถเพิ่มวิชาสอบของคุณเองได้โดยใช้ปุ่มเพิ่มวิชาสอบด้านบน'}
              </p>
            </div>
          )}

          {/* Unlisted / Petition Card */}
          <ExamUnlistedAlert unlistedInfo={unlistedInfo} lang={lang} />
        </div>
      )}

      {/* Manual Exam Modal */}
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
    </div>
  );
}
