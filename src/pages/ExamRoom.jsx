import { useState } from 'react';
import { ClipboardCheck, Lock, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
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

  // Local UI State for Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExamData, setEditingExamData] = useState(null);

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
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in py-2">
      {/* Page Header */}
      <div className="border-b border-dark-border/40 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-heading text-white flex items-center gap-2.5">
            <ClipboardCheck size={20} className="text-brand-400" />
            {t('examTitle', lang)}
          </h1>
          <p className="text-[11px] text-dark-muted mt-1 leading-relaxed">{t('examDesc', lang)}</p>
        </div>
        <button
          type="button"
          onClick={openNewModal}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-brand-500/10 cursor-pointer shrink-0 active:scale-98"
        >
          <Plus size={13} />
          {t('addExamBtn', lang)}
        </button>
      </div>

      {/* Security Warning Badge */}
      <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4 flex items-start gap-3 text-xs max-w-2xl text-amber-400/90 leading-relaxed">
        <Lock size={15} className="shrink-0 mt-0.5" />
        <p>{t('securityWarning', lang)}</p>
      </div>

      {/* Search Form Component */}
      <ExamSearchForm 
        studentId={studentId}
        setStudentId={setStudentId}
        onSearch={handleSearch}
        loading={loading}
        lang={lang}
      />

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
        <div className="space-y-6 animate-fade-in">
          
          {/* Outdated Data Warning */}
          {isOutdatedData && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-4 py-4 rounded-xl flex items-start gap-3 animate-fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
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
              <h3 className="font-semibold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-400" />
                {lang === 'en' ? 'Your Exam Seating Schedule' : 'ตารางและที่นั่งสอบของคุณ'}
              </h3>
              
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
            <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-8 text-center max-w-2xl animate-fade-in">
              <ClipboardCheck size={28} className="text-dark-muted mx-auto mb-3" />
              <h3 className="font-bold text-white text-sm mb-1">{t('noUpcomingExams', lang)}</h3>
              <p className="text-[11px] text-dark-muted leading-relaxed">
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
