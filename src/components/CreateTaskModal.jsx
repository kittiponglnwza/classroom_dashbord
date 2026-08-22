import { useState } from 'react';
import { X } from 'lucide-react';
import { t } from '../utils/i18n';

export default function CreateTaskModal({ isOpen, onClose, visibleCourses, lang, onAddAssignment }) {
  const [newTitle, setNewTitle] = useState('');
  const [newCourse, setNewCourse] = useState(visibleCourses[0]?.name || '');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPoints, setNewPoints] = useState(100);
  const [newDescription, setNewDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTitle || !newCourse || !newDueDate) return;

    const courseObj = visibleCourses.find(c => c.name === newCourse);
    const color = courseObj ? courseObj.color : 'blue';

    // Format newDueDate to date with end of day time
    const formattedDueDate = `${newDueDate}T23:59:59`;

    onAddAssignment({
      title: newTitle,
      course: newCourse,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-dark-card sm:border sm:border-white/10 rounded-none sm:rounded-3xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg overflow-y-auto custom-scrollbar animate-fade-in relative shadow-none sm:shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/5 sticky top-0 bg-dark-card/90 backdrop-blur-md z-10">
          <h3 className="font-bold text-xl text-white tracking-tight">{t('createTaskTitle', lang)}</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5 group/input relative">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-focus-within/input:text-brand-400 transition-colors">{lang === 'en' ? 'Title *' : 'หัวข้อการบ้าน *'}</label>
            <input
              type="text"
              required
              placeholder="e.g. Linux Lab 5"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-transparent border-b border-white/20 pb-2 pt-1 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand-500 transition-all rounded-none"
            />
            <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-brand-500 transition-all duration-300 group-focus-within/input:w-full"></div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5 group/input relative">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-focus-within/input:text-brand-400 transition-colors">{lang === 'en' ? 'Subject *' : 'วิชา *'}</label>
              <select
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                className="w-full bg-transparent border-b border-white/20 pb-2 pt-1 text-sm text-white focus:outline-none focus:border-brand-500 cursor-pointer transition-all rounded-none"
              >
                {visibleCourses.map(c => (
                  <option key={c.id} value={c.name} className="bg-dark-sidebar">{c.name}</option>
                ))}
              </select>
              <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-brand-500 transition-all duration-300 group-focus-within/input:w-full"></div>
            </div>
            <div className="space-y-1.5 group/input relative">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-focus-within/input:text-brand-400 transition-colors">{lang === 'en' ? 'Due Date *' : 'กำหนดส่ง *'}</label>
              <input
                type="date"
                required
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full bg-transparent border-b border-white/20 pb-2 pt-1 text-sm text-white focus:outline-none focus:border-brand-500 cursor-pointer transition-all rounded-none"
              />
              <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-brand-500 transition-all duration-300 group-focus-within/input:w-full"></div>
            </div>
          </div>

          <div className="space-y-1.5 group/input relative">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-focus-within/input:text-brand-400 transition-colors">{lang === 'en' ? 'Points' : 'คะแนนเต็ม'}</label>
            <input
              type="number"
              min="0"
              value={newPoints}
              onChange={(e) => setNewPoints(e.target.value)}
              className="w-full bg-transparent border-b border-white/20 pb-2 pt-1 text-sm text-white focus:outline-none focus:border-brand-500 transition-all rounded-none"
            />
            <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-brand-500 transition-all duration-300 group-focus-within/input:w-full"></div>
          </div>

          <div className="space-y-1.5 group/input relative">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-focus-within/input:text-brand-400 transition-colors">{lang === 'en' ? 'Description' : 'คำอธิบาย'}</label>
            <textarea
              rows="3"
              placeholder={lang === 'en' ? 'Describe details about this assignment...' : 'อธิบายรายละเอียดของการบ้านนี้...'}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full bg-transparent border-b border-white/20 pb-2 pt-1 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand-500 resize-none transition-all rounded-none"
            />
            <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-brand-500 transition-all duration-300 group-focus-within/input:w-full"></div>
          </div>

          <div className="flex justify-end gap-3 pt-6 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-2xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              {lang === 'en' ? 'Cancel' : 'ยกเลิก'}
            </button>
            <button
              type="submit"
              className="bg-brand-500 hover:bg-brand-400 text-white font-bold text-sm px-6 py-3 rounded-2xl transition-all duration-300 shadow-lg shadow-brand-500/20 hover:-translate-y-0.5"
            >
              {lang === 'en' ? 'Create Task' : 'สร้างงาน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
