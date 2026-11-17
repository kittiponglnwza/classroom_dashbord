import { useState, useEffect, useId } from 'react';
import { ClipboardCheck, X } from 'lucide-react';
import { t } from '../../utils/i18n';
import { parseLocalDateInput } from '../../utils/dateUtils';

const formatDisplayDate = (isoDateStr, lang) => {
  if (!isoDateStr) return '';
  const date = parseLocalDateInput(isoDateStr);
  if (!date) return isoDateStr;

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

const parseTimeRange = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return { start: '09:00', end: '12:00' };
  const parts = timeStr.split(/[-–]/).map(s => s.trim());
  const norm = (v, fb) => {
    const m = v?.match(/^(\d{1,2})[:.](\d{2})$/);
    if (!m) return fb;
    const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
    const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };
  return {
    start: norm(parts[0], '09:00'),
    end: norm(parts[1], '12:00')
  };
};

export default function ExamManualModal({ isOpen, initialData, onSave, onCancel, lang }) {
  const initialTimes = parseTimeRange(initialData?.time);
  const [formCode, setFormCode] = useState(() => initialData ? (initialData.courseCode === 'CLASSROOM' ? '' : (initialData.courseCode || '')) : '');
  const [formName, setFormName] = useState(() => initialData ? (initialData.courseName || '') : '');
  const [formDate, setFormDate] = useState(() => initialData ? (initialData.rawIsoDate || '') : '');
  const [startTime, setStartTime] = useState(() => initialTimes.start);
  const [endTime, setEndTime] = useState(() => initialTimes.end);
  const [formRoom, setFormRoom] = useState(() => initialData ? (initialData.room || '') : '');
  const [formSeat, setFormSeat] = useState(() => initialData ? (initialData.seat || '') : '');
  const [timeError, setTimeError] = useState('');

  const codeId = useId();
  const nameId = useId();
  const dateId = useId();
  const roomId = useId();
  const seatId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formName.trim() || !formDate || !startTime || !endTime) return;
    if (endTime <= startTime) {
      setTimeError(t('invalidTimeRange', lang));
      return;
    }
    setTimeError('');

    const displayDate = formatDisplayDate(formDate, lang);

    onSave({
      id: initialData ? initialData.id : 'new',
      courseCode: formCode.trim() || 'CLASSROOM',
      courseName: formName.trim(),
      date: displayDate,
      rawIsoDate: formDate,
      time: `${startTime} - ${endTime}`,
      room: formRoom.trim(),
      seat: formSeat.trim(),
      isManual: true
    });
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-manual-title"
        className="bg-[#252526] border border-[#3C3C3C] rounded-2xl w-full max-h-[90vh] max-w-md overflow-y-auto relative shadow-xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3C3C3C]">
          <h3 id="exam-manual-title" className="font-semibold text-sm text-[#FFFFFF] flex items-center gap-2">
            <ClipboardCheck size={16} className="text-[#3794FF]" />
            <span>{initialData ? t('examFormEditTitle', lang) : t('examFormTitle', lang)}</span>
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close modal"
            className="p-1 text-[#9D9D9D] hover:text-[#FFFFFF] rounded-lg hover:bg-[#2A2D2E] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label htmlFor={codeId} className="block text-xs font-medium text-[#D4D4D4] mb-1">{t('courseCodeLabel', lang)}</label>
              <input
                id={codeId}
                type="text"
                placeholder="e.g. 40613502"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor={nameId} className="block text-xs font-medium text-[#D4D4D4] mb-1">{t('courseNameLabel', lang)} *</label>
              <input
                id={nameId}
                type="text"
                required
                autoFocus
                placeholder="e.g. COMPUTER NETWORK"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={dateId} className="block text-xs font-medium text-[#D4D4D4] mb-1">{t('examDateLabel', lang)} *</label>
              <input
                id={dateId}
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#D4D4D4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] cursor-pointer"
              />
            </div>
            <div>
              <span className="block text-xs font-medium text-[#D4D4D4] mb-1">{t('examTimeLabel', lang)} *</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  aria-label={t('startTime', lang)}
                  required
                  value={startTime}
                  onChange={(e) => { setStartTime(e.target.value); setTimeError(''); }}
                  className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-2.5 py-2 text-xs text-[#D4D4D4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
                />
                <span className="text-[#858585]">-</span>
                <input
                  type="time"
                  aria-label={t('endTime', lang)}
                  required
                  value={endTime}
                  onChange={(e) => { setEndTime(e.target.value); setTimeError(''); }}
                  className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-2.5 py-2 text-xs text-[#D4D4D4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
                />
              </div>
              {timeError && <p role="alert" className="text-[11px] text-rose-400 mt-1">{timeError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={roomId} className="block text-xs font-medium text-[#D4D4D4] mb-1">{t('roomLabel', lang)}</label>
              <input
                id={roomId}
                type="text"
                placeholder="e.g. 81-506"
                value={formRoom}
                onChange={(e) => setFormRoom(e.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
              />
            </div>
            <div>
              <label htmlFor={seatId} className="block text-xs font-medium text-[#D4D4D4] mb-1">{t('seatNoLabel', lang)}</label>
              <input
                id={seatId}
                type="text"
                placeholder="e.g. Row 5, Seat 20"
                value={formSeat}
                onChange={(e) => setFormSeat(e.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#3C3C3C]">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors cursor-pointer"
            >
              {t('cancelBtn', lang)}
            </button>
            <button
              type="submit"
              className="bg-[#007ACC] hover:bg-[#1177BB] text-white font-medium text-xs px-5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              {t('saveExamBtn', lang)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
