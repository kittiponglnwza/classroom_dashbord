import { useState } from 'react';
import { ClipboardCheck, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-manual-title"
        className="bg-white border border-[#D2D2D7] rounded-2xl w-full max-h-[90vh] max-w-md overflow-y-auto relative shadow-lg flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D2D2D7]/70">
          <h3 id="exam-manual-title" className="font-semibold text-sm text-[#1D1D1F] flex items-center gap-2">
            <ClipboardCheck size={16} className="text-[#0071E3]" />
            <span>{initialData ? t('examFormEditTitle', lang) : t('examFormTitle', lang)}</span>
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-[#6E6E73] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-medium text-[#1D1D1F] mb-1">{t('courseCodeLabel', lang)}</label>
              <input
                type="text"
                placeholder="e.g. 40613502"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] placeholder-[#6E6E73] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#1D1D1F] mb-1">{t('courseNameLabel', lang)} *</label>
              <input
                type="text"
                required
                placeholder="e.g. COMPUTER NETWORK"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] placeholder-[#6E6E73] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#1D1D1F] mb-1">{t('examDateLabel', lang)} *</label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1D1D1F] mb-1">{t('examTimeLabel', lang)} *</label>
              <input
                type="text"
                required
                placeholder="09:00 - 12:00"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] placeholder-[#6E6E73] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#1D1D1F] mb-1">{t('roomLabel', lang)}</label>
              <input
                type="text"
                placeholder="e.g. 81-506"
                value={formRoom}
                onChange={(e) => setFormRoom(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] placeholder-[#6E6E73] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1D1D1F] mb-1">{t('seatNoLabel', lang)}</label>
              <input
                type="text"
                placeholder="e.g. Row 5, Seat 20"
                value={formSeat}
                onChange={(e) => setFormSeat(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] placeholder-[#6E6E73] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#D2D2D7]/70">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
            >
              {t('cancelBtn', lang)}
            </button>
            <button
              type="submit"
              className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-xs px-5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              {t('saveExamBtn', lang)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
