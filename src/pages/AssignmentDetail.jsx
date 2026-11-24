import { useState, useEffect, useRef, useId } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Paperclip, FileText, Clock,
  FileCode, Award, BookOpen, ExternalLink, Check, Trash2, Edit2, X
} from 'lucide-react';
import { t } from '../utils/i18n';
import { getCourseBadgeColor } from '../utils/colors';
import { calculateDueState, parseLocalDateInput } from '../utils/dateUtils';
import { sanitizeExternalUrl } from '../utils/sanitize';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';
import PageHeader from '../components/PageHeader';

function formatDueDateDisplay(dueDate, lang) {
  if (!dueDate) return null;
  const parsed = parseLocalDateInput(dueDate);
  if (!parsed) return dueDate;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim());
  return parsed.toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(isDateOnly ? {} : { hour: '2-digit', minute: '2-digit' })
  });
}

function toDatetimeLocalValue(dueDate) {
  if (!dueDate) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) return `${dueDate.trim()}T23:59`;
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
  const {
    assignments, handleStatusChange, handleNotesChange,
    handleDueDateChange, handleUpdateAssignment, handleDeleteAssignment
  } = useClassroom();
  const ui = useClassroomUI();
  const visibleCourses = ui?.visibleCourses || [];

  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const assignment = assignments.find(a => String(a.id) === String(id));

  const [noteContent, setNoteContent] = useState(assignment?.notes || '');
  const [noteSaved, setNoteSaved] = useState(false);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [tempDueDate, setTempDueDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCourse, setEditCourse] = useState('');
  const [editPoints, setEditPoints] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const statusId = useId();
  const editTitleId = useId();
  const editCourseId = useId();
  const editPointsId = useId();
  const editDescId = useId();

  const isNotesDirtyRef = useRef(false);
  const noteContentRef = useRef(noteContent);
  const noteSaveTimerRef = useRef(null);
  const lastAssignIdRef = useRef(id);

  useEffect(() => {
    noteContentRef.current = noteContent;
  }, [noteContent]);

  // Reset dirty tracking when switching assignment IDs
  useEffect(() => {
    if (lastAssignIdRef.current !== id) {
      lastAssignIdRef.current = id;
      isNotesDirtyRef.current = false;
      setConfirmDelete(false);
      setIsEditingTask(false);
      setNoteContent(assignment?.notes || '');
    }
  }, [id, assignment?.notes]);

  // Only hydrate notes from background sync when the user doesn't have unsaved local edits
  useEffect(() => {
    if (assignment && !isNotesDirtyRef.current) {
      setNoteContent(assignment.notes || '');
    }
  }, [assignment?.notes, assignment]);

  // Flush dirty notes and clear timers on unmount / route switch
  useEffect(() => {
    const activeId = id;
    return () => {
      if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current);
      if (isNotesDirtyRef.current && handleNotesChange) {
        isNotesDirtyRef.current = false;
        handleNotesChange(activeId, noteContentRef.current);
      }
    };
  }, [id, handleNotesChange]);

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
  const safeGoogleLink = sanitizeExternalUrl(googleLink);
  const isCustomTask = String(id).startsWith('assign-');

  const handleNotesBlur = () => {
    isNotesDirtyRef.current = false;
    if (noteContent !== (assignment.notes || '')) {
      handleNotesChange(id, noteContent);
      setNoteSaved(true);
      if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current);
      noteSaveTimerRef.current = setTimeout(() => setNoteSaved(false), 2000);
    }
  };

  const getDaysLeft = () => {
    const state = calculateDueState(dueDate, status);
    switch (state.type) {
      case 'done':
        return { text: t('completed', lang), color: 'text-emerald-400' };
      case 'read':
        return { text: t('read', lang), color: 'text-sky-400' };
      case 'noDate':
        return { text: t('noDueDate', lang), color: 'text-[#9D9D9D]' };
      case 'overdue':
        return {
          text: state.diffDays === 0
            ? t('overdueHrs', lang, { hrs: state.diffHrs })
            : t('overdueDays', lang, { days: state.diffDays }),
          color: 'text-rose-400'
        };
      case 'dueToday':
        return {
          text: state.diffHrs === 0
            ? t('minsLeftToday', lang, { mins: state.diffMins })
            : t('hrsLeftToday', lang, { hrs: state.diffHrs }),
          color: 'text-amber-400 font-semibold'
        };
      case 'dueTomorrow':
        return { text: t('dueTomorrow', lang), color: 'text-amber-400' };
      case 'dueLater':
        return { text: t('daysLeft', lang, { days: state.diffDays }), color: 'text-[#FFFFFF]' };
      default:
        return { text: t('noDueDate', lang), color: 'text-[#9D9D9D]' };
    }
  };

  const daysInfo = getDaysLeft();
  const formattedDue = formatDueDateDisplay(dueDate, lang);

  const openTaskEditor = () => {
    setEditTitle(title || '');
    setEditCourse(course || '');
    setEditPoints(points === null || points === undefined ? '' : String(points));
    setEditDescription(description || '');
    setIsEditingTask(true);
  };

  const saveTaskEdit = (e) => {
    e.preventDefault();
    if (!editTitle.trim() || !handleUpdateAssignment) return;
    const courseObj = visibleCourses.find(c => c.name === editCourse);
    handleUpdateAssignment(id, {
      title: editTitle.trim(),
      course: editCourse || course,
      courseCode: courseObj?.code || courseCode,
      courseId: courseObj?.id || assignment.courseId,
      courseColor: courseObj?.color || courseColor,
      points: editPoints === '' ? null : Number(editPoints),
      description: editDescription
    });
    setIsEditingTask(false);
  };

  const sourceCrumb = fromPath.startsWith('/courses')
    ? { label: t('courses', lang), to: fromPath }
    : fromPath === '/'
      ? { label: t('home', lang), to: '/' }
      : fromPath.startsWith('/schedule')
        ? { label: t('schedule', lang), to: fromPath }
        : { label: t('assignmentsNav', lang), to: '/dashboard' };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          sourceCrumb,
          ...(course ? [{ label: course, to: `/courses?selected=${encodeURIComponent(course)}&tab=assignments` }] : []),
          { label: lang === 'th' ? 'รายละเอียดงาน' : 'Details' }
        ]}
        title={title}
        description={courseCode ? `${courseCode} • ${course}` : course}
        actions={
          <>
            <button
              type="button"
              onClick={handleBack}
              data-testid="assignment-back-button"
              className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>{getBackLabel()}</span>
            </button>
            {course && (
              <Link
                to={`/courses?selected=${encodeURIComponent(course)}&tab=assignments`}
                state={{ from: `${location.pathname}${location.search}` }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary-bright)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-3.5 py-2.5 rounded-xl transition-colors"
              >
                <BookOpen size={14} />
                <span>{t('openCoursePage', lang)}</span>
              </Link>
            )}
            {isCustomTask && handleUpdateAssignment && !isEditingTask && (
              <button
                type="button"
                onClick={openTaskEditor}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <Edit2 size={13} />
                <span>{t('editTaskBtn', lang)}</span>
              </button>
            )}
            {isCustomTask && handleDeleteAssignment && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true);
                      return;
                    }
                    handleDeleteAssignment(id);
                    handleBack();
                  }}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                    confirmDelete
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'text-rose-400 bg-[var(--surface)] hover:bg-rose-500/15 border-[var(--border)]'
                  }`}
                >
                  <Trash2 size={14} />
                  <span>{confirmDelete ? t('confirmBtn', lang) : t('deleteBtn', lang)}</span>
                </button>
                {confirmDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="inline-flex items-center gap-1 text-xs font-medium px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <X size={13} />
                    <span>{t('cancelBtn', lang)}</span>
                  </button>
                )}
              </div>
            )}
            {safeGoogleLink && (
              <a
                href={safeGoogleLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-3.5 py-2.5 rounded-xl transition-colors"
              >
                <span>Google Classroom</span>
                <ExternalLink size={13} className="text-[var(--text-muted)]" />
              </a>
            )}
          </>
        }
      />

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
                <label htmlFor={statusId} className="text-xs text-[#9D9D9D] font-medium">{t('statusLabel', lang)}</label>
                <select
                  id={statusId}
                  aria-label={t('statusLabel', lang)}
                  value={status}
                  onChange={(e) => handleStatusChange(id, e.target.value)}
                  className={`text-xs px-3.5 py-2 rounded-xl bg-[#1E1E1E] border border-[#3C3C3C] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] font-semibold transition-colors ${
                    status === 'todo'
                      ? 'text-[#D4D4D4]'
                      : status === 'doing'
                        ? 'text-amber-400'
                        : status === 'read'
                          ? 'text-sky-400'
                          : 'text-emerald-400'
                  }`}
                >
                  <option value="todo" className="bg-[#252526] text-[#D4D4D4]">{t('todo', lang)}</option>
                  <option value="doing" className="bg-[#252526] text-[#D4D4D4]">{t('doing', lang)}</option>
                  <option value="done" className="bg-[#252526] text-[#D4D4D4]">{t('done', lang)}</option>
                  <option value="read" className="bg-[#252526] text-[#D4D4D4]">{t('read', lang)}</option>
                </select>
              </div>
            </div>

            {isEditingTask ? (
              <form onSubmit={saveTaskEdit} className="space-y-4 bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-4">
                <div className="space-y-1.5">
                  <label htmlFor={editTitleId} className="block text-xs font-medium text-[#D4D4D4]">{lang === 'en' ? 'Title *' : 'ชื่องาน *'}</label>
                  <input
                    id={editTitleId}
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-[#252526] border border-[#3C3C3C] rounded-xl px-3 py-2 text-sm text-[#FFFFFF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor={editCourseId} className="block text-xs font-medium text-[#D4D4D4]">{lang === 'en' ? 'Subject' : 'วิชา'}</label>
                    <select
                      id={editCourseId}
                      value={editCourse}
                      onChange={(e) => setEditCourse(e.target.value)}
                      className="w-full bg-[#252526] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#D4D4D4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
                    >
                      {!visibleCourses.some(c => c.name === editCourse) && editCourse && (
                        <option value={editCourse}>{editCourse}</option>
                      )}
                      {visibleCourses.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={editPointsId} className="block text-xs font-medium text-[#D4D4D4]">{lang === 'en' ? 'Points' : 'คะแนนเต็ม'}</label>
                    <input
                      id={editPointsId}
                      type="number"
                      min="0"
                      max="1000"
                      value={editPoints}
                      onChange={(e) => setEditPoints(e.target.value)}
                      className="w-full bg-[#252526] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#D4D4D4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={editDescId} className="block text-xs font-medium text-[#D4D4D4]">{t('descriptionHeader', lang)}</label>
                  <textarea
                    id={editDescId}
                    rows="4"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-[#252526] border border-[#3C3C3C] rounded-xl p-3 text-xs text-[#D4D4D4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingTask(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] cursor-pointer"
                  >
                    {t('cancelBtn', lang)}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-[#007ACC] hover:bg-[#1177BB] text-white cursor-pointer"
                  >
                    {t('saveBtn', lang)}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-4 flex items-center gap-3.5">
                      <div className="p-2.5 bg-[#252526] border border-[#3C3C3C] rounded-xl text-[#3794FF] shrink-0">
                        <Calendar size={17} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-[#858585] block font-medium">{t('dueDateLabel', lang)}</span>
                        {isEditingDueDate ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <input
                              type="datetime-local"
                              aria-label={t('dueDateLabel', lang)}
                              className="w-full bg-[#252526] border border-[#3C3C3C] rounded-lg px-2 py-1 text-xs text-[#D4D4D4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
                              value={tempDueDate}
                              onChange={(e) => setTempDueDate(e.target.value)}
                              onBlur={() => {
                                if (tempDueDate !== toDatetimeLocalValue(dueDate)) {
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
                            {tempDueDate && (
                              <button
                                type="button"
                                aria-label={t('noDueDate', lang)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setTempDueDate('');
                                  handleDueDateChange(id, '');
                                  setIsEditingDueDate(false);
                                }}
                                title={t('noDueDate', lang)}
                                className="p-1 text-[#858585] hover:text-rose-400 cursor-pointer shrink-0"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
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
                        <span className="text-xs font-semibold text-[#FFFFFF]">
                          {typeof points === 'number'
                            ? `${points} ${lang === 'en' ? 'Points' : 'คะแนน'}`
                            : t('ungraded', lang)}
                        </span>
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
              </>
            )}

            {attachments && attachments.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-2">
                  <Paperclip size={15} className="text-[#3794FF]" />
                  <span>{t('attachmentsHeader', lang)}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.map((file, i) => {
                    const safeAttachmentLink = sanitizeExternalUrl(file.link);
                    if (safeAttachmentLink) {
                      return (
                        <a
                          key={i}
                          href={safeAttachmentLink}
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
                  aria-label={t('workspaceHeader', lang)}
                  value={noteContent}
                  onChange={(e) => {
                    isNotesDirtyRef.current = true;
                    setNoteContent(e.target.value);
                  }}
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
