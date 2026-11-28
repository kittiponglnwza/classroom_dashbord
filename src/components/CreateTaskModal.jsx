import { useState, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { t } from '../utils/i18n';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';

export default function CreateTaskModal({ isOpen, onClose, visibleCourses, lang, onAddAssignment }) {
  const [newTitle, setNewTitle] = useState('');
  const [newCourse, setNewCourse] = useState(visibleCourses[0]?.name || '');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPoints, setNewPoints] = useState(100);
  const [newDescription, setNewDescription] = useState('');
  const dialogRef = useRef(null);
  const titleInputRef = useRef(null);

  const titleId = useId();
  const courseId = useId();
  const dueDateId = useId();
  const pointsId = useId();
  const descId = useId();

  const selectedCourse = newCourse || visibleCourses[0]?.name || 'General';

  const handleCloseReset = () => {
    setNewTitle('');
    setNewDueDate('');
    setNewPoints(100);
    setNewDescription('');
    onClose();
  };

  useDialogFocusTrap(isOpen, dialogRef, {
    onClose: handleCloseReset,
    initialFocusRef: titleInputRef,
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !selectedCourse || !newDueDate) return;

    const courseObj = visibleCourses.find(c => c.name === selectedCourse);
    const color = courseObj ? courseObj.color : 'blue';
    const formattedDueDate = newDueDate;

    onAddAssignment({
      title: newTitle.trim(),
      course: selectedCourse,
      courseCode: courseObj?.code || '',
      courseId: courseObj?.id || '',
      dueDate: formattedDueDate,
      status: 'todo',
      points: newPoints === '' ? null : Number(newPoints),
      description: newDescription,
      attachments: [],
      courseColor: color
    });

    handleCloseReset();
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) handleCloseReset(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-xl w-full max-h-[90vh] max-w-lg overflow-y-auto relative"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] z-10">
          <h3 id="create-task-title" className="text-base font-medium text-[var(--text-heading)]">
            {t('createTaskTitle', lang)}
          </h3>
          <button
            type="button"
            onClick={handleCloseReset}
            aria-label="Close modal"
            className="w-11 h-11 sm:w-9 sm:h-9 -mr-2 sm:mr-0 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-heading)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor={titleId} className="block text-xs font-medium text-[var(--text-primary)]">
              {lang === 'en' ? 'Task Title *' : 'ชื่องาน *'}
            </label>
            <input
              ref={titleInputRef}
              id={titleId}
              type="text"
              required
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={lang === 'en' ? 'e.g. Read Chapter 4 & Summarize' : 'เช่น อ่านบทที่ 4 และสรุปเนื้อหา'}
              className="w-full bg-[var(--app-bg)] border border-[var(--border)] rounded-lg px-3.5 py-2.5 text-base sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor={courseId} className="block text-xs font-medium text-[var(--text-primary)]">
                {lang === 'en' ? 'Subject *' : 'วิชา *'}
              </label>
              <select
                id={courseId}
                value={selectedCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                className="w-full bg-[var(--app-bg)] border border-[var(--border)] rounded-lg px-3.5 py-2.5 text-base sm:text-sm text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] cursor-pointer transition-colors"
              >
                {visibleCourses.length === 0 && (
                  <option value="General">General</option>
                )}
                {visibleCourses.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={dueDateId} className="block text-xs font-medium text-[var(--text-primary)]">
                {lang === 'en' ? 'Due Date *' : 'กำหนดส่ง *'}
              </label>
              <input
                id={dueDateId}
                type="date"
                required
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full bg-[var(--app-bg)] border border-[var(--border)] rounded-lg px-3.5 py-2.5 text-base sm:text-sm text-[var(--text-primary)] font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] cursor-pointer transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={pointsId} className="block text-xs font-medium text-[var(--text-primary)]">
              {lang === 'en' ? 'Points / Weight' : 'คะแนนเต็ม'}
            </label>
            <input
              id={pointsId}
              type="number"
              min="0"
              max="1000"
              value={newPoints}
              onChange={(e) => setNewPoints(e.target.value)}
              className="w-full bg-[var(--app-bg)] border border-[var(--border)] rounded-lg px-3.5 py-2.5 text-base sm:text-sm text-[var(--text-primary)] font-mono tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={descId} className="block text-xs font-medium text-[var(--text-primary)]">
              {lang === 'en' ? 'Description & Instructions' : 'รายละเอียดงาน'}
            </label>
            <textarea
              id={descId}
              rows="4"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={lang === 'en' ? 'Add details, links, or notes...' : 'ใส่รายละเอียด ลิงก์อ้างอิง หรือบันทึกเพิ่มเติม...'}
              className="w-full bg-[var(--app-bg)] border border-[var(--border)] rounded-lg p-3.5 text-base sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-colors resize-none"
            />
          </div>

          <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseReset}
              className="px-4 min-h-11 sm:min-h-9 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              {lang === 'en' ? 'Cancel' : 'ยกเลิก'}
            </button>
            <button
              type="submit"
              className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-xs px-5 min-h-11 sm:min-h-9 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-bright)]"
            >
              {lang === 'en' ? 'Create Task' : 'บันทึกงาน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
