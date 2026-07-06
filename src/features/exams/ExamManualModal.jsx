import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { t } from '../../utils/i18n';

const formatDisplayDate = (isoDateStr, lang) => {
  if (!isoDateStr) return '';
  const date = new Date(isoDateStr);
  if (isNaN(date.getTime())) return isoDateStr;
  
  if (lang === 'th') {
    const thaiMonthsAbbr = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const day = date.getDate();
    const month = thaiMonthsAbbr[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  } else {
    const engMonthsAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate();
    const month = engMonthsAbbr[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }
};

export default function ExamManualModal({ isOpen, initialData, onSave, onCancel, lang }) {
  const [formCode, setFormCode] = useState(() => initialData ? (initialData.courseCode === 'CLASSROOM' ? '' : (initialData.courseCode || '')) : '');
  const [formName, setFormName] = useState(() => initialData ? (initialData.courseName || '') : '');
  const [formDate, setFormDate] = useState(() => initialData ? (initialData.rawIsoDate || '') : '');
  const [formTime, setFormTime] = useState(() => initialData ? (initialData.time || '') : '');
  const [formRoom, setFormRoom] = useState(() => initialData ? (initialData.room || '') : '');
  const [formSeat, setFormSeat] = useState(() => initialData ? (initialData.seat || '') : '');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formName || !formDate || !formTime) return;

    const displayDate = formatDisplayDate(formDate, lang);
    
    onSave({
      id: initialData ? initialData.id : 'new',
      courseCode: formCode.trim() || 'CLASSROOM',
      courseName: formName.trim(),
      date: displayDate,
      rawIsoDate: formDate,
      time: formTime.trim(),
      room: formRoom.trim(),
      seat: formSeat.trim(),
      isManual: true
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dark-border/40">
          <h3 className="font-semibold font-heading text-sm text-white flex items-center gap-2">
            <ClipboardCheck size={16} className="text-brand-400" />
            {initialData ? t('examFormEditTitle', lang) : t('examFormTitle', lang)}
          </h3>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">{t('courseCodeLabel', lang)}</label>
              <input
                type="text"
                placeholder="e.g. 40613502"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full bg-dark-sidebar border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500/60"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">{t('courseNameLabel', lang)} *</label>
              <input
                type="text"
                required
                placeholder="e.g. COMPUTER NETWORK"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-dark-sidebar border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">{t('examDateLabel', lang)} *</label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full bg-dark-sidebar border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500/60 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">{t('examTimeLabel', lang)} *</label>
              <input
                type="text"
                required
                placeholder="09:00 - 12:00"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full bg-dark-sidebar border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">{t('roomLabel', lang)}</label>
              <input
                type="text"
                placeholder="e.g. 81-506"
                value={formRoom}
                onChange={(e) => setFormRoom(e.target.value)}
                className="w-full bg-dark-sidebar border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500/60"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">{t('seatNoLabel', lang)}</label>
              <input
                type="text"
                placeholder="e.g. Row 5, Seat 20"
                value={formSeat}
                onChange={(e) => setFormSeat(e.target.value)}
                className="w-full bg-dark-sidebar border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500/60"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-border/40">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-dark-muted hover:text-white transition-colors cursor-pointer"
            >
              {t('cancelBtn', lang)}
            </button>
            <button
              type="submit"
              className="bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs px-5 py-2 rounded-xl transition-all cursor-pointer shadow-md shadow-brand-500/10 active:scale-95"
            >
              {t('saveExamBtn', lang)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
