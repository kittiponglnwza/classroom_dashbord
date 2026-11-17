import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Paperclip, FileText, Clock,
  FileCode, Award, BookOpen, ExternalLink, Check
} from 'lucide-react';
import { t } from '../utils/i18n';
import { getCourseBadgeColor } from '../utils/colors';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';

function formatDueDateDisplay(dueDate, lang) {
  if (!dueDate) return null;
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return dueDate;
  return parsed.toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function toDatetimeLocalValue(dueDate) {
  if (!dueDate) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dueDate)) return dueDate;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dueDate)) return dueDate.slice(0, 16);
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export default function AssignmentDetail() {
  const { lang } = useSettings();
  const { assignments, handleStatusChange, handleNotesChange, handleDueDateChange } = useClassroom();

  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const assignment = assignments.find(a => String(a.id) === String(id));

  const [noteContent, setNoteContent] = useState(assignment?.notes || '');
  const [noteSaved, setNoteSaved] = useState(false);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [tempDueDate, setTempDueDate] = useState('');

  useEffect(() => {
    if (assignment) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoteContent(assignment.notes || '');
    }
  }, [assignment?.notes, assignment]);

  const fromPath = location.state?.from || '';

  const getBackLabel = () => {
    if (fromPath === '/') {
      return t('backToHome', lang);
    }
    if (fromPath.startsWith('/courses')) {
      const courseName = location.state?.fromCourse || assignment?.course;
      if (courseName && fromPath.includes('selected=')) {
        return t('backToCourse', lang, { course: courseName });
      }
      return t('courses', lang);
    }
    if (fromPath.startsWith('/schedule')) {
      return t('backToSchedule', lang);
    }
    return t('backDashboard', lang);
  };

  const handleBack = () => {
    if (fromPath) {
      navigate(fromPath);
    } else if (assignment?.course) {
      navigate('/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  if (!assignment) {
    return (
      <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-10 text-center max-w-lg mx-auto mt-10 space-y-4">
        <h3 className="text-lg font-semibold text-[#FFFFFF]">{t('detailNotFound', lang)}</h3>
        <p className="text-[#9D9D9D] text-xs">{t('detailNotFoundDesc', lang)}</p>
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 bg-[#007ACC] hover:bg-[#1177BB] text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>{getBackLabel()}</span>
        </button>
      </div>
    );
  }

  const { title, course, courseCode, dueDate, status, points, attachments, description, courseColor, googleLink } = assignment;

  const handleNotesBlur = () => {
    if (noteContent !== (assignment.notes || '')) {
      handleNotesChange(id, noteContent);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }
  };

  const getDaysLeft = () => {
    if (status === 'done') {
      return { text: t('completed', lang), color: 'text-emerald-400' };
    }
    if (!dueDate) {
      return { text: lang === 'en' ? 'No due date' : 'ไม่มีกำหนดส่ง', color: 'text-[#9D9D9D]' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) {
      return { text: lang === 'en' ? 'No due date' : 'ไม่มีกำหนดส่ง', color: 'text-[#9D9D9D]' };
    }
    due.setHours(0, 0, 0, 0);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: t('overdueDays', lang, { days: Math.abs(diffDays) }), color: 'text-rose-400' };
    } else if (diffDays === 0) {
      return { text: lang === 'en' ? 'Due today' : 'ส่งภายในวันนี้', color: 'text-amber-400 font-semibold' };
    } else if (diffDays === 1) {
      return { text: t('dueTomorrow', lang), color: 'text-amber-400' };
    } else {
      return { text: t('daysLeft', lang, { days: diffDays }), color: 'text-[#FFFFFF]' };
    }
  };

  const daysInfo = getDaysLeft();
  const formattedDue = formatDueDateDisplay(dueDate, lang);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          data-testid="assignment-back-button"
          className="inline-flex items-center gap-2 text-xs font-medium text-[#D4D4D4] bg-[#252526] hover:bg-[#2A2D2E] border border-[#3C3C3C] px-4 py-2 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft size={15} />
          <span>{getBackLabel()}</span>
        </button>

        <div className="flex items-center gap-2">
          {course && (
            <Link
              to={`/courses?selected=${encodeURIComponent(course)}&tab=assignments`}
              state={{ from: `${location.pathname}${location.search}` }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3794FF] bg-[#252526] hover:bg-[#2A2D2E] border border-[#3C3C3C] px-3.5 py-2 rounded-xl transition-colors"
            >
              <BookOpen size={14} />
              <span>{t('openCoursePage', lang)}</span>
            </Link>
          )}
          {googleLink && (
            <a
              href={googleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D4D4D4] bg-[#252526] hover:bg-[#2A2D2E] border border-[#3C3C3C] px-3.5 py-2 rounded-xl transition-colors"
            >
              <span>Google Classroom</span>
              <ExternalLink size={13} className="text-[#858585]" />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6 md:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3C3C3C] pb-5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-3 py-1 rounded-lg ${getCourseBadgeColor(courseColor)}`}>
                  {courseCode ? `${courseCode} • ${course}` : course}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-[#9D9D9D] font-medium">{t('statusLabel', lang)}</span>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(id, e.target.value)}
                  className={`text-xs px-3.5 py-2 rounded-xl bg-[#1E1E1E] border border-[#3C3C3C] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] font-semibold transition-colors ${
                    status === 'todo'
                      ? 'text-[#D4D4D4]'
                      : status === 'doing'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                  }`}
                >
                  <option value="todo">{t('todo', lang)}</option>
                  <option value="doing">{t('doing', lang)}</option>
                  <option value="done">{t('done', lang)}</option>
                </select>
              </div>
            </div>

            <div className="space-y-5">
              <h1 className="text-2xl md:text-3xl font-semibold text-[#FFFFFF] tracking-tight leading-snug">
                {title}
              </h1>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-4 flex items-center gap-3.5">
                  <div className="p-2.5 bg-[#252526] border border-[#3C3C3C] rounded-xl text-[#3794FF] shrink-0">
                    <Calendar size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-[#858585] block font-medium">{t('dueDateLabel', lang)}</span>
                    {isEditingDueDate ? (
                      <input
                        type="datetime-local"
                        className="w-full bg-[#252526] border border-[#3C3C3C] rounded-lg px-2 py-1 text-xs text-[#D4D4D4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
                        value={tempDueDate}
                        onChange={(e) => setTempDueDate(e.target.value)}
                        onBlur={() => {
                          if (tempDueDate && tempDueDate !== toDatetimeLocalValue(dueDate)) {
                            handleDueDateChange(id, tempDueDate);
                          }
                          setIsEditingDueDate(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          } else if (e.key === 'Escape') {
                            setIsEditingDueDate(false);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#FFFFFF] hover:text-[#3794FF] border-b border-dashed border-[#858585] text-left truncate max-w-full cursor-pointer"
                        onClick={() => {
                          setTempDueDate(toDatetimeLocalValue(dueDate));
                          setIsEditingDueDate(true);
                        }}
                      >
                        {formattedDue || t('noDueDate', lang)}
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-4 flex items-center gap-3.5">
                  <div className="p-2.5 bg-[#252526] border border-[#3C3C3C] rounded-xl text-amber-400 shrink-0">
                    <Award size={17} />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#858585] block font-medium">{t('gradeWeightLabel', lang)}</span>
                    <span className="text-xs font-semibold text-[#FFFFFF]">{points} {lang === 'en' ? 'Points' : 'คะแนน'}</span>
                  </div>
                </div>

                <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-4 flex items-center gap-3.5">
                  <div className="p-2.5 bg-[#252526] border border-[#3C3C3C] rounded-xl text-[#3794FF] shrink-0">
                    <Clock size={17} />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#858585] block font-medium">{t('countdownLabel', lang)}</span>
                    <span className={`text-xs font-semibold ${daysInfo.color}`}>{daysInfo.text}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <h3 className="text-xs font-semibold text-[#FFFFFF]">{t('descriptionHeader', lang)}</h3>
              <p className="text-sm text-[#D4D4D4] leading-relaxed whitespace-pre-line bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-5">
                {description || t('noDescription', lang)}
              </p>
            </div>

            {attachments && attachments.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-2">
                  <Paperclip size={15} className="text-[#3794FF]" />
                  <span>{t('attachmentsHeader', lang)}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.map((file, i) => {
                    const hasLink = file.link && file.link.trim() !== '';
                    if (hasLink) {
                      return (
                        <a
                          key={i}
                          href={file.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-[#1E1E1E] hover:bg-[#2A2D2E] border border-[#3C3C3C] rounded-xl p-3.5 flex items-center justify-between gap-3 transition-colors group"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileCode size={18} className="text-[#3794FF] shrink-0" />
                            <div className="text-left overflow-hidden">
                              <p className="text-xs font-semibold text-[#D4D4D4] truncate group-hover:text-[#3794FF] transition-colors">
                                {file.name}
                              </p>
                              <p className="text-[11px] text-[#858585] mt-0.5">{file.size}</p>
                            </div>
                          </div>
                          <span className="text-[11px] font-medium text-[#3794FF] border border-[#007ACC]/40 bg-[#007ACC]/20 px-2.5 py-1 rounded-lg shrink-0">
                            {t('downloadBtn', lang)}
                          </span>
                        </a>
                      );
                    }
                    return (
                      <div
                        key={i}
                        className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileCode size={18} className="text-[#858585] shrink-0" />
                          <div className="text-left overflow-hidden">
                            <p className="text-xs font-medium text-[#D4D4D4] truncate">{file.name}</p>
                            <p className="text-[11px] text-[#858585] mt-0.5">{file.size}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6 h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-2">
                  <FileText size={15} className="text-[#3794FF]" />
                  <span>{t('workspaceHeader', lang)}</span>
                </h3>
                {noteSaved && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <Check size={12} />
                    {lang === 'en' ? 'Saved' : 'บันทึกแล้ว'}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#9D9D9D] leading-relaxed">
                {t('workspaceDesc', lang)}
              </p>

              <div className="pt-1">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  onBlur={handleNotesBlur}
                  rows="16"
                  placeholder={t('workspacePlaceholder', lang)}
                  className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-4 py-3 text-xs text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] transition-colors font-mono resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="border-t border-[#3C3C3C] pt-4 mt-6 text-center">
              <p className="text-[11px] text-[#858585] flex items-center justify-center gap-1.5">
                <BookOpen size={12} />
                <span>{t('savedLocally', lang)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
