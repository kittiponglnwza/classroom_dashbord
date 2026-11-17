import { useState } from 'react';
import { X } from 'lucide-react';
import { t } from '../utils/i18n';

export default function CreateTaskModal({ isOpen, onClose, visibleCourses, lang, onAddAssignment }) {
  const [newTitle, setNewTitle] = useState('');
  const [newCourse, setNewCourse] = useState(visibleCourses[0]?.name || '');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPoints, setNewPoints] = useState(100);
  const [newDescription, setNewDescription] = useState('');

  const selectedCourse = newCourse || visibleCourses[0]?.name || 'General';

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTitle || !selectedCourse || !newDueDate) return;

    const courseObj = visibleCourses.find(c => c.name === selectedCourse);
    const color = courseObj ? courseObj.color : 'blue';
    const formattedDueDate = `${newDueDate}T23:59:59`;

    onAddAssignment({
      title: newTitle,
      course: selectedCourse,
      courseCode: courseObj?.code || '',
      courseId: courseObj?.id || '',
      dueDate: formattedDueDate,
      status: 'todo',
      points: Number(newPoints),
      description: newDescription,
      attachments: [],
      courseColor: color
    });

    setNewTitle('');
    setNewDueDate('');
    setNewPoints(100);
    setNewDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        className="bg-white border border-[#D2D2D7] rounded-2xl w-full max-h-[90vh] max-w-lg overflow-y-auto relative shadow-lg"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D2D2D7]/70 sticky top-0 bg-white z-10">
          <h3 id="create-task-title" className="text-base font-semibold text-[#1D1D1F]">
            {t('createTaskTitle', lang)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#1D1D1F]">
              {lang === 'en' ? 'Task Title *' : 'ชื่องาน *'}
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={lang === 'en' ? 'e.g. Read Chapter 4 & Summarize' : 'เช่น อ่านบทที่ 4 และสรุปเนื้อหา'}
              className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#6E6E73] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#1D1D1F]">
                {lang === 'en' ? 'Subject *' : 'วิชา *'}
              </label>
              <select
                value={selectedCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white cursor-pointer transition-colors"
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
              <label className="block text-xs font-medium text-[#1D1D1F]">
                {lang === 'en' ? 'Due Date *' : 'กำหนดส่ง *'}
              </label>
              <input
                type="date"
                required
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white cursor-pointer transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#1D1D1F]">
              {lang === 'en' ? 'Points / Weight' : 'คะแนนเต็ม'}
            </label>
            <input
              type="number"
              min="0"
              max="1000"
              value={newPoints}
              onChange={(e) => setNewPoints(e.target.value)}
              className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#1D1D1F]">
              {lang === 'en' ? 'Description & Instructions' : 'รายละเอียดงาน'}
            </label>
            <textarea
              rows="4"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={lang === 'en' ? 'Add details, links, or notes...' : 'ใส่รายละเอียด ลิงก์อ้างอิง หรือบันทึกเพิ่มเติม...'}
              className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl p-3.5 text-sm text-[#1D1D1F] placeholder-[#6E6E73] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white transition-colors resize-none"
            />
          </div>

          <div className="pt-3 border-t border-[#D2D2D7]/70 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
            >
              {lang === 'en' ? 'Cancel' : 'ยกเลิก'}
            </button>
            <button
              type="submit"
              className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              {lang === 'en' ? 'Create Task' : 'บันทึกงาน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
