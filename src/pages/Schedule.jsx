import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { CalendarDays, CalendarX2, Plus, X, AlertTriangle, LayoutGrid, List, Clock, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { t } from '../utils/i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';
import { useAuth } from '../contexts/AuthContext';
import { useExams } from '../hooks/useExams';
import { parseExamDate } from '../utils/examDate';

import { DAYS, JS_DAY_MAP } from '../constants/dateConstants';

const DAY_KEYS = {
  mon: 'dayMon', tue: 'dayTue', wed: 'dayWed', thu: 'dayThu',
  fri: 'dayFri', sat: 'daySat', sun: 'daySun',
};
const DAY_SHORT_KEYS = {
  mon: 'dayMonShort', tue: 'dayTueShort', wed: 'dayWedShort', thu: 'dayThuShort',
  fri: 'dayFriShort', sat: 'daySatShort', sun: 'daySunShort',
};
const PRESET_COLORS = [
  '#0071E3', '#059669', '#D97706', '#E11D48', '#7C3AED',
  '#0284C7', '#EA580C', '#4F46E5', '#0D9488', '#6E6E73',
];
const START_HOUR = 6;
const END_HOUR = 24;

const TRADITIONAL_DAY_COLORS = {
  mon: '#F59E0B',
  tue: '#EC4899',
  wed: '#10B981',
  thu: '#F97316',
  fri: '#0EA5E9',
  sat: '#8B5CF6',
  sun: '#EF4444'
};

const COLOR_MAP = {
  emerald: '#059669',
  blue: '#0071E3',
  amber: '#D97706',
  rose: '#E11D48',
  purple: '#7C3AED',
  zinc: '#6E6E73',
  gray: '#6E6E73',
  red: '#E11D48',
  green: '#059669',
  orange: '#EA580C'
};

function resolveHexColor(colorStr) {
  if (!colorStr) return '#0071E3';
  if (colorStr.startsWith('#')) return colorStr;
  return COLOR_MAP[colorStr.toLowerCase()] || '#0071E3';
}

function addHoursToTime(timeStr, hours) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = h * 60 + m + Math.round(hours * 60);
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function getTodayKey() {
  const d = new Date().getDay();
  return JS_DAY_MAP[d];
}

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeToMinutes(tStr) {
  const [h, m] = tStr.split(':').map(Number);
  return h * 60 + m;
}

function formatTimeRange(start, end) {
  return `${start} – ${end}`;
}

function hasConflict(entry, allEntries, excludeId = null) {
  const start = timeToMinutes(entry.startTime);
  const end = timeToMinutes(entry.endTime);
  return allEntries.some(e => {
    if (e.id === excludeId) return false;
    if (e.deletedAt) return false;
    if (e.day !== entry.day) return false;
    if (e.date && entry.date && e.date !== entry.date) return false;

    const eStart = timeToMinutes(e.startTime);
    const eEnd = timeToMinutes(e.endTime);
    return start < eEnd && end > eStart;
  });
}

function getWeekDates(offset, lang) {
  const today = new Date();
  today.setDate(today.getDate() + (offset * 7));
  const currentDay = today.getDay();
  const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayDiff);

  const map = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = toLocalDateStr(d);
    map[DAYS[i]] = {
      dateStr,
      formatted: d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' }),
      dayName: d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { weekday: 'long' })
    };
  }
  return map;
}

function timeToPercent(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const minutes = h * 60 + m;
  const startMinutes = START_HOUR * 60;
  const totalMinutes = (END_HOUR - START_HOUR) * 60;
  return Math.min(Math.max(((minutes - startMinutes) / totalMinutes) * 100, 0), 100);
}

// ─── MINI CALENDAR WIDGET ──────────────────────────────────────────
function MiniCalendar({ schedule, lang, weekOffset, setWeekOffset, weekDates }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [prevWeekOffset, setPrevWeekOffset] = useState(weekOffset);

  if (weekOffset !== prevWeekOffset) {
    setPrevWeekOffset(weekOffset);
    if (weekDates && weekDates['mon']) {
      const [yy, mm, dd] = weekDates['mon'].dateStr.split('-').map(Number);
      const monDate = new Date(yy, mm - 1, dd);
      if (monDate.getMonth() !== currentDate.getMonth() || monDate.getFullYear() !== currentDate.getFullYear()) {
        setCurrentDate(new Date(monDate.getFullYear(), monDate.getMonth(), 1));
      }
    }
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => {
    const d = new Date(year, month, 1).getDay();
    return d === 0 ? 6 : d - 1;
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const monthNames = lang === 'en'
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  const dayNames = lang === 'en' ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const todayStr = toLocalDateStr(new Date());

  const handleDayClick = (dayNum) => {
    const clickedDate = new Date(year, month, dayNum);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cDay = clickedDate.getDay();
    const cDiff = cDay === 0 ? -6 : 1 - cDay;
    const cMonday = new Date(clickedDate);
    cMonday.setDate(clickedDate.getDate() + cDiff);

    const tDay = today.getDay();
    const tDiff = tDay === 0 ? -6 : 1 - tDay;
    const tMonday = new Date(today);
    tMonday.setDate(today.getDate() + tDiff);

    const diffTime = cMonday.getTime() - tMonday.getTime();
    const diffWeeks = Math.round(diffTime / (1000 * 60 * 60 * 24 * 7));
    setWeekOffset(diffWeeks);
  };

  const renderDots = (dayNum) => {
    const dateStr = toLocalDateStr(new Date(year, month, dayNum));
    const dObj = new Date(year, month, dayNum);
    const dayIndex = dObj.getDay();
    const dayKey = JS_DAY_MAP[dayIndex];

    const dayEntries = schedule.filter(entry => {
      if (entry.deletedAt && dateStr >= entry.deletedAt) return false;
      if (entry.isExam || entry.isAssignment || entry.date) {
        return entry.date === dateStr;
      }
      return entry.day === dayKey;
    });

    if (dayEntries.length === 0) return null;

    const colors = Array.from(new Set(dayEntries.map(e => resolveHexColor(e.color)))).slice(0, 3);

    return (
      <div className="flex gap-0.5 justify-center mt-0.5 absolute bottom-1 left-1/2 -translate-x-1/2">
        {colors.map((c, i) => (
          <div key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: c }} />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white border border-[#D2D2D7]/80 rounded-2xl p-4 shadow-2xs">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-[#1D1D1F] font-semibold text-sm">
          {monthNames[month]} {lang === 'th' ? year + 543 : year}
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {dayNames.map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-[#6E6E73] py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="p-2" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dateStr = toLocalDateStr(new Date(year, month, dayNum));
          const isToday = dateStr === todayStr;

          let isSelectedWeek = false;
          if (weekDates) {
            isSelectedWeek = Object.values(weekDates).some(w => w.dateStr === dateStr);
          }

          return (
            <button
              type="button"
              key={dayNum}
              onClick={() => handleDayClick(dayNum)}
              className={`relative h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors cursor-pointer ${
                isToday
                  ? 'bg-[#0071E3] text-white font-semibold'
                  : isSelectedWeek
                    ? 'bg-[#F5F5F7] text-[#1D1D1F] font-semibold'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
              }`}
            >
              <span>{dayNum}</span>
              {renderDots(dayNum)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── WEEKLY GRID VIEW ──────────────────────────────────────────────
function WeeklyGrid({ schedule, lang, todayKey, currentMinutes, weekDates, weekOffset, onClickBlock, onClickEmpty }) {
  const gridRef = useRef(null);

  const timeLabels = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    timeLabels.push(`${String(h).padStart(2, '0')}:00`);
  }

  const entriesByDay = useMemo(() => {
    const map = {};
    DAYS.forEach(d => { map[d] = []; });

    const activeExams = [];
    const activeRegular = [];

    schedule.forEach(entry => {
      if (entry.deletedAt && weekDates[entry.day] && weekDates[entry.day].dateStr >= entry.deletedAt) return;
      if (entry.isExam) {
        if (entry.date === weekDates[entry.day].dateStr) {
          activeExams.push(entry);
        }
      } else {
        if (!entry.date || entry.date === weekDates[entry.day].dateStr) {
          activeRegular.push(entry);
        }
      }
    });

    const filteredRegular = activeRegular.filter(regEntry => {
      const conflictFound = activeExams.some(exam => {
        if (exam.day !== regEntry.day) return false;
        const codeMatch = regEntry.courseCode && exam.courseCode &&
          regEntry.courseCode.toLowerCase().trim() === exam.courseCode.toLowerCase().trim();
        const titleMatch = regEntry.title && exam.title &&
          regEntry.title.toLowerCase().trim() === exam.title.toLowerCase().trim();
        if (codeMatch || titleMatch) return true;

        const startReg = timeToMinutes(regEntry.startTime);
        const endReg = timeToMinutes(regEntry.endTime);
        const startExam = timeToMinutes(exam.startTime);
        const endExam = timeToMinutes(exam.endTime);
        return startReg < endExam && endReg > startExam;
      });
      return !conflictFound;
    });

    [...filteredRegular, ...activeExams].forEach(entry => {
      if (map[entry.day]) {
        map[entry.day].push(entry);
      }
    });

    return map;
  }, [schedule, weekDates]);

  const handleRowClick = useCallback((day, e) => {
    if (e.target.closest('[data-schedule-block]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const minutes = START_HOUR * 60 + percent * (END_HOUR - START_HOUR) * 60;

    const roundedMinutes = Math.round(minutes / 30) * 30;
    const hour = Math.floor(roundedMinutes / 60);
    const minute = roundedMinutes % 60;
    const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const endHour = Math.min(hour + 1, END_HOUR);
    const endTime = `${String(endHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const specificDate = weekDates[day].dateStr;
    onClickEmpty(day, startTime, endTime, specificDate);
  }, [onClickEmpty, weekDates]);

  const currentTimePercent = (currentMinutes !== null && weekOffset === 0)
    ? timeToPercent(`${Math.floor(currentMinutes / 60)}:${currentMinutes % 60}`)
    : null;
  const showTimeLine = currentTimePercent !== null && currentTimePercent >= 0 && currentTimePercent <= 100;

  return (
    <div className="bg-white border border-[#D2D2D7]/80 rounded-2xl overflow-hidden shadow-2xs">
      <div className="overflow-x-auto" ref={gridRef}>
        <div className="min-w-[768px] w-full relative">
          {/* Time headers row */}
          <div className="grid grid-cols-[120px_repeat(18,1fr)] border-b border-[#D2D2D7]/80 bg-[#F5F5F7]">
            <div className="p-3 text-center text-[11px] font-semibold text-[#6E6E73] flex items-center justify-center border-r border-[#D2D2D7]/70 select-none">
              {lang === 'en' ? 'Day / Time' : 'วัน / เวลา'}
            </div>
            {timeLabels.map((label) => (
              <div
                key={label}
                className="p-2.5 text-center border-l border-[#D2D2D7]/50 flex items-center justify-center min-w-0 select-none"
              >
                <span className="text-[10px] font-mono font-medium text-[#6E6E73]">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Grid rows */}
          <div className="flex flex-col relative">
            {DAYS.map(day => {
              const isToday = day === todayKey && weekOffset === 0;
              return (
                <div
                  key={day}
                  className="grid grid-cols-[120px_1fr] relative border-b border-[#D2D2D7]/60 min-h-[74px]"
                >
                  <div className="flex items-center gap-2.5 p-3 border-r border-[#D2D2D7]/70 select-none bg-[#F5F5F7]/40 shrink-0">
                    <div className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: TRADITIONAL_DAY_COLORS[day] }} />
                    <div className="flex flex-col items-start min-w-0">
                      <span className={`text-xs font-semibold truncate leading-tight ${isToday ? 'text-[#0071E3]' : 'text-[#1D1D1F]'}`}>
                        {t(DAY_KEYS[day], lang)}
                      </span>
                      <span className={`text-[10px] leading-none mt-0.5 ${isToday ? 'text-[#0071E3]' : 'text-[#6E6E73]'}`}>
                        {weekDates[day].formatted}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`relative cursor-pointer transition-colors hover:bg-[#F5F5F7]/60 flex-1 ${
                      isToday ? 'bg-blue-50/30' : ''
                    }`}
                    onClick={(e) => handleRowClick(day, e)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(day, e);
                      }
                    }}
                  >
                    <div className="absolute inset-0 grid grid-cols-[repeat(18,1fr)] pointer-events-none">
                      {Array.from({ length: 18 }).map((_, idx) => (
                        <div key={idx} className="border-l border-[#D2D2D7]/40 h-full" />
                      ))}
                    </div>

                    {entriesByDay[day].map(entry => {
                      const startPercent = timeToPercent(entry.startTime);
                      const endPercent = timeToPercent(entry.endTime);
                      const left = startPercent;
                      const width = Math.max(endPercent - startPercent, 1.5);

                      const isAssign = entry.isAssignment;
                      const isAllDay = isAssign && entry.startTime === '06:00' && entry.endTime === '24:00';
                      const accentHex = resolveHexColor(entry.color);

                      return (
                        <div
                          key={entry.id}
                          data-schedule-block
                          onClick={(e) => { e.stopPropagation(); onClickBlock(entry, weekDates[day].dateStr); }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onClickBlock(entry, weekDates[day].dateStr);
                            }
                          }}
                          className="absolute rounded-lg overflow-hidden cursor-pointer transition-colors group flex flex-col justify-center bg-white hover:bg-[#F5F5F7] shadow-2xs"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            top: isAllDay ? '6%' : (isAssign ? '14%' : '10%'),
                            bottom: isAllDay ? 'auto' : (isAssign ? '14%' : '10%'),
                            height: isAllDay ? '24px' : undefined,
                            border: `1px solid ${accentHex}45`,
                            borderLeft: `3px solid ${accentHex}`,
                            zIndex: isAssign ? 20 : 10,
                          }}
                        >
                          <div className={`px-2 py-1 h-full flex flex-col justify-center ${isAllDay ? 'flex-row items-center justify-start gap-2' : 'items-start'} overflow-hidden`}>
                            <div className="flex items-center gap-1.5 min-w-0 w-full">
                              <span className="font-semibold text-[#1D1D1F] leading-tight truncate text-[11px]">
                                {entry.courseCode ? `${entry.courseCode} ${isAssign ? '' : `(${entry.title})`}` : entry.title}
                              </span>
                              {entry.date && !isAssign && (
                                <span className="text-[9px] px-1 py-0.25 rounded font-medium bg-amber-50 text-amber-800 border border-amber-200 shrink-0 select-none">
                                  {lang === 'en' ? 'Once' : 'พิเศษ'}
                                </span>
                              )}
                            </div>

                            {isAssign && !isAllDay && (
                              <span className="text-[10px] text-[#6E6E73] font-medium mt-0.5 truncate">
                                Due: {entry.endTime}
                              </span>
                            )}

                            {entry.room && !isAssign && (
                              <span className="text-[10px] text-[#6E6E73] font-medium mt-0.5 truncate">
                                {entry.room}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {isToday && showTimeLine && (
                      <div
                        className="absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center"
                        style={{ left: `${currentTimePercent}%` }}
                      >
                        <div className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                        <div className="flex-1 w-[1.5px] bg-rose-600" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 text-[11px] text-[#6E6E73] border-t border-[#D2D2D7]/60 bg-[#F5F5F7]/50">
        {lang === 'en'
          ? '* Click any class to edit, click an assignment or exam to view its details, or click an empty slot to add a class.'
          : '* คลิกวิชาเรียนเพื่อแก้ไข คลิกงานหรือวิชาสอบเพื่อเปิดดูรายละเอียด หรือคลิกช่องว่างเพื่อเพิ่มตารางเรียน'}
      </div>
    </div>
  );
}

// ─── DAILY LIST VIEW ───────────────────────────────────────────────
function DailyList({ schedule, lang, todayKey, selectedDay, setSelectedDay, weekDates, onClickCard }) {
  const dayEntries = useMemo(() => {
    const dayExams = [];
    const dayRegular = [];

    schedule.forEach(e => {
      if (e.day === selectedDay) {
        if (e.deletedAt && weekDates[selectedDay] && weekDates[selectedDay].dateStr >= e.deletedAt) return;
        if (e.isExam) {
          if (e.date === weekDates[selectedDay].dateStr) {
            dayExams.push(e);
          }
        } else {
          if (!e.date || e.date === weekDates[selectedDay].dateStr) {
            dayRegular.push(e);
          }
        }
      }
    });

    const filteredRegular = dayRegular.filter(regEntry => {
      const conflictFound = dayExams.some(exam => {
        const codeMatch = regEntry.courseCode && exam.courseCode &&
          regEntry.courseCode.toLowerCase().trim() === exam.courseCode.toLowerCase().trim();
        const titleMatch = regEntry.title && exam.title &&
          regEntry.title.toLowerCase().trim() === exam.title.toLowerCase().trim();
        if (codeMatch || titleMatch) return true;

        const startReg = timeToMinutes(regEntry.startTime);
        const endReg = timeToMinutes(regEntry.endTime);
        const startExam = timeToMinutes(exam.startTime);
        const endExam = timeToMinutes(exam.endTime);
        return startReg < endExam && endReg > startExam;
      });
      return !conflictFound;
    });

    return [...filteredRegular, ...dayExams]
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [schedule, selectedDay, weekDates]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map(day => {
          const isSelected = selectedDay === day;
          const isToday = day === todayKey;
          return (
            <button
              type="button"
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors shrink-0 flex flex-col items-center min-w-[70px] cursor-pointer border ${
                isSelected
                  ? 'bg-[#0071E3] text-white border-[#0071E3] font-semibold'
                  : isToday
                    ? 'bg-blue-50 text-[#0071E3] border-blue-200'
                    : 'bg-white text-[#6E6E73] border-[#D2D2D7] hover:text-[#1D1D1F]'
              }`}
            >
              <span>{t(DAY_SHORT_KEYS[day], lang)}</span>
              <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/90' : 'text-[#6E6E73]'}`}>
                {weekDates[day].formatted}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-semibold text-[#1D1D1F]">
          {weekDates[selectedDay].dayName}
        </span>
        <span className="text-xs text-[#6E6E73]">({weekDates[selectedDay].formatted})</span>
      </div>

      {dayEntries.length > 0 ? (
        <div className="space-y-2.5">
          {dayEntries.map(entry => (
            <button
              type="button"
              key={entry.id}
              onClick={() => onClickCard(entry, weekDates[selectedDay].dateStr)}
              className="w-full text-left bg-white border border-[#D2D2D7]/80 rounded-2xl p-4 hover:border-[#0071E3]/40 transition-colors group flex items-center justify-between cursor-pointer shadow-2xs"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: resolveHexColor(entry.color) }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors truncate">
                      {entry.title}
                    </h4>
                    {entry.courseCode && (
                      <span className="text-[11px] font-medium text-[#6E6E73] bg-[#F5F5F7] px-2 py-0.5 rounded-md shrink-0 border border-[#D2D2D7]/70">
                        {entry.courseCode}
                      </span>
                    )}
                    {entry.date && !entry.isAssignment && !entry.isExam && (
                      <span className="text-[10px] px-1.5 py-0.25 rounded-md font-medium bg-amber-50 text-amber-800 border border-amber-200 shrink-0 select-none">
                        {lang === 'en' ? 'Special Class' : 'คาบเรียนพิเศษ'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[#6E6E73]">
                    <span className="text-xs font-medium flex items-center gap-1.5">
                      <Clock size={12} className="text-[#0071E3]" />
                      {formatTimeRange(entry.startTime, entry.endTime)}
                    </span>
                    {entry.room && (
                      <span className="text-xs font-medium bg-[#F5F5F7] px-2 py-0.5 rounded-md border border-[#D2D2D7]/70 text-[#1D1D1F]">
                        {entry.room}
                      </span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-[#6E6E73] mt-1.5 max-w-xl leading-relaxed line-clamp-2">
                      {entry.notes}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-[#6E6E73] group-hover:text-[#0071E3] transition-colors shrink-0 ml-4" />
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#D2D2D7] border-dashed rounded-2xl p-12 text-center">
          <CalendarX2 size={32} className="text-[#6E6E73] mx-auto mb-2.5 opacity-60" />
          <p className="text-xs font-medium text-[#6E6E73]">{t('noClasses', lang)}</p>
        </div>
      )}
    </div>
  );
}

// ─── ADD / EDIT MODAL ──────────────────────────────────────────────
function ScheduleModal({ isOpen, entry, visibleCourses, schedule, lang, onSave, onDelete, onClose }) {
  const isEdit = Boolean(entry?.id);

  const [formData, setFormData] = useState({
    title: entry?.title || '',
    courseCode: entry?.courseCode || '',
    courseId: entry?.courseId || '',
    day: entry?.day || 'mon',
    date: entry?.date || '',
    startTime: entry?.startTime || '09:00',
    endTime: entry?.endTime || '10:00',
    room: entry?.room || '',
    color: entry?.color || PRESET_COLORS[0],
    notes: entry?.notes || '',
  });

  const [classType, setClassType] = useState(entry?.id && entry?.date ? 'one-off' : 'recurring');
  const [isCustom, setIsCustom] = useState(!entry?.courseId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const update = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const handleApplyDuration = (hours) => {
    if (formData.startTime) {
      update('endTime', addHoursToTime(formData.startTime, hours));
    }
  };

  const handleCourseSelect = (e) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setIsCustom(true);
      setFormData(prev => ({
        ...prev,
        title: '',
        courseCode: '',
        courseId: '',
      }));
    } else {
      const course = visibleCourses.find(c => c.id === val);
      if (course) {
        setIsCustom(false);
        setFormData(prev => ({
          ...prev,
          title: course.name,
          courseCode: course.code || '',
          courseId: course.id,
          color: course.color || prev.color,
        }));
      }
    }
  };

  const handleDateChange = (dateVal) => {
    update('date', dateVal);
    if (dateVal) {
      const [yy, mm, dd] = dateVal.split('-').map(Number);
      const d = new Date(yy, mm - 1, dd);
      const dayIndex = d.getDay();
      const dayKey = JS_DAY_MAP[dayIndex];
      update('day', dayKey);
    }
  };

  const handleTypeChange = (type) => {
    setClassType(type);
    if (type === 'recurring') {
      update('date', '');
    } else {
      const todayStr = toLocalDateStr(new Date());
      handleDateChange(todayStr);
    }
  };

  const conflict = useMemo(() => {
    if (!formData.startTime || !formData.endTime) return false;
    if (timeToMinutes(formData.endTime) <= timeToMinutes(formData.startTime)) return false;
    return hasConflict(formData, schedule, entry?.id);
  }, [formData, schedule, entry?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.startTime || !formData.endTime) return;

    const restEntry = { ...(entry || {}) };
    delete restEntry._clickedDateStr;
    const saved = {
      ...restEntry,
      ...formData,
      date: classType === 'one-off' ? formData.date : '',
      id: entry?.id || `sched-${Date.now()}`,
    };
    onSave(saved);
  };

  const handleDelete = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    onDelete(entry.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white border border-[#D2D2D7] rounded-2xl p-6 max-w-lg w-full max-h-[90vh] relative shadow-lg overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 border-b border-[#D2D2D7]/70 pb-3 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-base text-[#1D1D1F]">
            {isEdit ? t('editSchedule', lang) : t('addSchedule', lang)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#6E6E73] hover:text-[#1D1D1F] p-1.5 rounded-lg hover:bg-[#F5F5F7] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {conflict && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 mb-4">
            <AlertTriangle size={14} className="shrink-0 text-amber-600" />
            <span>{t('timeConflict', lang)}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div>
            <label className="block text-xs font-medium text-[#1D1D1F] mb-1.5">
              {t('classType', lang)}
            </label>
            <div className="flex gap-1.5 p-1 bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl">
              <button
                type="button"
                onClick={() => handleTypeChange('recurring')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  classType === 'recurring' ? 'bg-white text-[#0071E3] shadow-2xs font-semibold' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                {t('recurringWeekly', lang)}
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('one-off')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  classType === 'one-off' ? 'bg-white text-[#0071E3] shadow-2xs font-semibold' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                {t('oneOff', lang)}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1D1D1F] mb-1.5">
              {t('selectCourse', lang)}
            </label>
            <select
              value={isCustom ? '__custom__' : formData.courseId}
              onChange={handleCourseSelect}
              className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white cursor-pointer"
            >
              <option value="__custom__">{t('customEntry', lang)}</option>
              {visibleCourses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#1D1D1F] mb-1.5">
                {t('courseName', lang)}
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => update('title', e.target.value)}
                readOnly={!isCustom}
                className={`w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white ${!isCustom ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1D1D1F] mb-1.5">
                {t('courseCodeLabel', lang)}
              </label>
              <input
                type="text"
                value={formData.courseCode}
                onChange={(e) => update('courseCode', e.target.value)}
                readOnly={!isCustom}
                className={`w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white ${!isCustom ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>

          {classType === 'one-off' ? (
            <div>
              <label className="block text-xs font-medium text-[#1D1D1F] mb-1.5">
                {t('selectDate', lang)}
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white cursor-pointer"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-[#1D1D1F] mb-1.5">
                {t('schedule', lang)}
              </label>
              <select
                value={formData.day}
                onChange={(e) => update('day', e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white cursor-pointer"
              >
                {DAYS.map(d => (
                  <option key={d} value={d}>{t(DAY_KEYS[d], lang)}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#1D1D1F] mb-1.5">
                {t('startTime', lang)}
              </label>
              <input
                type="time"
                required
                value={formData.startTime}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    startTime: val,
                    endTime: addHoursToTime(val, 3)
                  }));
                }}
                className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white cursor-pointer"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[#1D1D1F] leading-none">
                  {t('endTime', lang)}
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleApplyDuration(1.5)}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-[#0071E3] border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer leading-none"
                    title="+1.5 Hours"
                  >
                    +1.5h
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDuration(3)}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-[#0071E3] border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer leading-none"
                    title="+3 Hours"
                  >
                    +3h
                  </button>
                </div>
              </div>
              <input
                type="time"
                required
                value={formData.endTime}
                onChange={(e) => update('endTime', e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1D1D1F] mb-1.5">
              {t('roomLabel', lang)}
            </label>
            <input
              type="text"
              value={formData.room}
              onChange={(e) => update('room', e.target.value)}
              className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white"
            />
          </div>

          {isCustom && (
            <div>
              <label className="block text-xs font-medium text-[#1D1D1F] mb-1.5">
                {t('colorLabel', lang)}
              </label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update('color', c)}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      formData.color === c ? 'ring-2 ring-offset-2 ring-[#1D1D1F] scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#1D1D1F] mb-1.5">
              {t('scheduleNotes', lang)}
            </label>
            <textarea
              rows="2"
              value={formData.notes}
              onChange={(e) => update('notes', e.target.value)}
              className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3.5 py-2.5 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white resize-none"
            />
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-[#D2D2D7]/70 mt-4">
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className={`px-3.5 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                    showDeleteConfirm
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  {showDeleteConfirm ? t('confirmBtn', lang) : t('deleteBtn', lang)}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-xl transition-colors cursor-pointer"
              >
                {t('cancelBtn', lang)}
              </button>
              <button
                type="submit"
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-xs px-5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                {t('saveBtn', lang)}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN SCHEDULE PAGE ────────────────────────────────────────────
export default function Schedule() {
  const { lang } = useSettings();
  const { profile } = useAuth();
  const { schedule, assignments, handleSaveScheduleEntry, handleDeleteScheduleEntry, handleClearSchedule } = useClassroom();
  const { visibleCourses } = useClassroomUI();

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const todayKey = getTodayKey();
  const viewType = searchParams.get('view') || 'weekly';
  const selectedDay = searchParams.get('day') || todayKey;
  const weekOffset = parseInt(searchParams.get('week') || '0', 10) || 0;

  const updateScheduleParams = useCallback((updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === undefined || (k === 'view' && v === 'weekly') || (k === 'week' && Number(v) === 0)) {
          next.delete(k);
        } else {
          next.set(k, String(v));
        }
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setViewType = useCallback((v) => updateScheduleParams({ view: v }), [updateScheduleParams]);
  const setSelectedDay = useCallback((d) => updateScheduleParams({ day: d }), [updateScheduleParams]);
  const setWeekOffset = useCallback((updater) => {
    const nextVal = typeof updater === 'function' ? updater(weekOffset) : updater;
    updateScheduleParams({ week: nextVal });
  }, [updateScheduleParams, weekOffset]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const activeEmail = (profile?.email || '').toLowerCase().trim();
  const { allExams } = useExams(activeEmail, lang, schedule);

  const examScheduleEntries = useMemo(() => {
    return allExams.map(ex => {
      let startTime = '09:00';
      let endTime = '12:00';
      if (ex.time) {
        const parts = ex.time.split('-').map(s => s.trim());
        if (parts.length === 2) {
          startTime = parts[0];
          endTime = parts[1];
        }
      }

      let dateVal = '';
      if (ex.rawIsoDate) {
        dateVal = ex.rawIsoDate.split('T')[0];
      } else if (ex.date) {
        const parsed = parseExamDate(ex.date);
        if (parsed) {
          dateVal = toLocalDateStr(parsed);
        }
      }

      if (!dateVal) return null;

      const [ey, em, ed] = dateVal.split('-').map(Number);
      const d = new Date(ey, em - 1, ed);
      const dayIndex = d.getDay();
      const dayKey = JS_DAY_MAP[dayIndex];

      return {
        id: `exam-${ex.id}`,
        title: ex.subjectName || ex.courseName || 'Exam',
        courseCode: ex.subjectCode || ex.courseCode || '',
        day: dayKey,
        date: dateVal,
        startTime,
        endTime,
        room: ex.room ? `${ex.room} ${ex.seat ? `(${ex.seat})` : ''}` : '',
        color: '#E11D48',
        notes: ex.seat ? `Seat/Row: ${ex.seat}` : '',
        isExam: true
      };
    }).filter(Boolean);
  }, [allExams]);

  const assignmentScheduleEntries = useMemo(() => {
    if (!assignments) return [];
    return assignments
      .filter(a => a.status !== 'done' && a.dueDate)
      .map(a => {
        let dateVal;
        let startTime;
        let endTime;

        const hasTime = a.dueDate.includes('T');
        if (hasTime) {
          const isLocalEndOfDay = a.dueDate.includes('23:59:59');
          const isLocalTimeInput = a.dueDate.length === 16;
          const isoString = (a.dueDate.endsWith('Z') || a.dueDate.includes('+') || isLocalEndOfDay || isLocalTimeInput)
            ? a.dueDate
            : `${a.dueDate}Z`;

          const dObj = new Date(isoString);

          if (!isNaN(dObj.getTime())) {
            dateVal = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
            const h = dObj.getHours();
            const m = dObj.getMinutes();
            endTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            const startH = Math.max(6, h - 2);
            startTime = `${String(startH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          } else {
            const [dPart, tPart] = a.dueDate.split('T');
            dateVal = dPart;
            const timePart = tPart.split('.')[0].substring(0, 5);
            endTime = timePart;
            const [h, m] = timePart.split(':').map(Number);
            startTime = `${String(Math.max(6, h - 2)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
        } else {
          dateVal = a.dueDate;
          startTime = '06:00';
          endTime = '24:00';
        }

        if (!dateVal) return null;

        const [ay, am, ad] = dateVal.split('-').map(Number);
        const d = new Date(ay, am - 1, ad);
        const dayIndex = d.getDay();
        const dayKey = JS_DAY_MAP[dayIndex];

        return {
          id: `assignment-${a.id}`,
          rawAssignmentId: a.id,
          title: a.title,
          courseCode: a.course || '',
          day: dayKey,
          date: dateVal,
          startTime,
          endTime,
          room: '',
          color: a.courseColor || '#7C3AED',
          notes: a.description || '',
          isAssignment: true
        };
      }).filter(Boolean);
  }, [assignments]);

  const combinedSchedule = useMemo(() => {
    return [...schedule, ...examScheduleEntries, ...assignmentScheduleEntries];
  }, [schedule, examScheduleEntries, assignmentScheduleEntries]);

  const weekDates = useMemo(() => {
    return getWeekDates(weekOffset, lang);
  }, [weekOffset, lang]);

  const weekRangeStr = useMemo(() => {
    if (!weekDates || !weekDates.mon || !weekDates.sun) return '';
    return `${weekDates.mon.formatted} – ${weekDates.sun.formatted}`;
  }, [weekDates]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const todayClasses = useMemo(() => {
    const today = new Date();
    const todayIdx = today.getDay();
    const todayKeyVal = JS_DAY_MAP[todayIdx];
    const todayDateStr = toLocalDateStr(today);

    const activeExams = [];
    const activeRegular = [];

    combinedSchedule.forEach(entry => {
      if (entry.deletedAt && todayDateStr >= entry.deletedAt) return;
      if (entry.isAssignment) return;
      if (entry.isExam) {
        if (entry.date === todayDateStr) activeExams.push(entry);
      } else {
        if (entry.day === todayKeyVal && (!entry.date || entry.date === todayDateStr)) {
          activeRegular.push(entry);
        }
      }
    });

    const filteredRegular = activeRegular.filter(regEntry => {
      return !activeExams.some(exam => {
        const codeMatch = regEntry.courseCode && exam.courseCode &&
          regEntry.courseCode.toLowerCase().trim() === exam.courseCode.toLowerCase().trim();
        const titleMatch = regEntry.title && exam.title &&
          regEntry.title.toLowerCase().trim() === exam.title.toLowerCase().trim();
        if (codeMatch || titleMatch) return true;

        const startReg = timeToMinutes(regEntry.startTime);
        const endReg = timeToMinutes(regEntry.endTime);
        const startExam = timeToMinutes(exam.startTime);
        const endExam = timeToMinutes(exam.endTime);
        return startReg < endExam && endReg > startExam;
      });
    });

    return [...filteredRegular, ...activeExams].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [combinedSchedule]);

  const openAddModal = useCallback((day, startTime, endTime, dateVal = '') => {
    setEditingEntry(null);
    setPrefillData({
      day,
      startTime,
      endTime,
      date: dateVal
    });
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((entry, clickedDateStr) => {
    const currentFrom = `${location.pathname}${location.search}`;
    if (entry.isAssignment && entry.rawAssignmentId) {
      navigate(`/assignments/${entry.rawAssignmentId}`, { state: { from: currentFrom } });
      return;
    }
    if (entry.isExam) {
      navigate('/exam-room', { state: { from: currentFrom } });
      return;
    }
    setEditingEntry({ ...entry, _clickedDateStr: clickedDateStr });
    setPrefillData(null);
    setIsModalOpen(true);
  }, [location.pathname, location.search, navigate]);

  const openBlankAdd = useCallback(() => {
    setEditingEntry(null);
    setPrefillData(null);
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback((entryData) => {
    handleSaveScheduleEntry(entryData);
    setIsModalOpen(false);
    setEditingEntry(null);
    setPrefillData(null);
  }, [handleSaveScheduleEntry]);

  const handleDelete = useCallback((id) => {
    handleDeleteScheduleEntry(id, editingEntry?._clickedDateStr);
    setIsModalOpen(false);
    setEditingEntry(null);
  }, [handleDeleteScheduleEntry, editingEntry]);

  const handleClearAll = () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }
    handleClearSchedule();
    setShowClearConfirm(false);
  };

  const modalEntry = editingEntry || (prefillData ? {
    title: '',
    courseCode: '',
    courseId: '',
    day: prefillData.day,
    date: prefillData.date,
    startTime: prefillData.startTime,
    endTime: prefillData.endTime,
    room: '',
    color: PRESET_COLORS[0],
    notes: '',
  } : null);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight flex items-center gap-2.5">
            <CalendarDays size={22} className="text-[#0071E3]" />
            <span>{t('scheduleTitle', lang)}</span>
          </h1>
          <p className="text-xs text-[#6E6E73] mt-1 leading-relaxed">{t('scheduleDesc', lang)}</p>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          {schedule.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className={`text-xs font-medium py-2.5 px-4 rounded-xl border transition-colors cursor-pointer ${
                showClearConfirm
                  ? 'text-rose-700 bg-rose-50 border-rose-200'
                  : 'text-[#6E6E73] bg-white border-[#D2D2D7] hover:text-rose-600'
              }`}
            >
              {showClearConfirm ? t('clearAllConfirm', lang) : t('clearAllSchedule', lang)}
            </button>
          )}

          <div className="hidden md:flex items-center border border-[#D2D2D7] rounded-xl p-0.5 bg-[#F5F5F7]">
            <button
              type="button"
              onClick={() => setViewType('weekly')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewType === 'weekly' ? 'bg-white text-[#0071E3] shadow-2xs' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
              title={t('weeklyView', lang)}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewType('daily')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewType === 'daily' ? 'bg-white text-[#0071E3] shadow-2xs' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
              title={t('dailyView', lang)}
            >
              <List size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={openBlankAdd}
            className="flex items-center justify-center gap-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>{t('addSchedule', lang)}</span>
          </button>
        </div>
      </div>

      {/* Week Navigation controls */}
      <div className="flex items-center justify-between bg-white border border-[#D2D2D7]/80 rounded-2xl px-4 py-3 shadow-2xs">
        <div className="flex items-center border border-[#D2D2D7] rounded-xl p-0.5 bg-[#F5F5F7] shrink-0">
          <button
            type="button"
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-white transition-colors cursor-pointer"
            title={t('prevWeek', lang)}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              weekOffset === 0
                ? 'bg-white text-[#0071E3] shadow-2xs font-semibold'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            {t('thisWeek', lang)}
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-white transition-colors cursor-pointer"
            title={t('nextWeek', lang)}
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="text-xs font-medium text-[#1D1D1F] px-3 py-1 bg-[#F5F5F7] rounded-lg border border-[#D2D2D7]/70 select-none hidden sm:block">
          {weekRangeStr}
        </div>

        <div className="bg-blue-50 border border-blue-200 px-3 py-1 rounded-full text-[11px] font-medium text-[#0071E3] select-none shrink-0">
          {weekOffset === 0
            ? (lang === 'en' ? 'Current Week' : 'สัปดาห์ปัจจุบัน')
            : weekOffset === 1
              ? (lang === 'en' ? 'Next Week' : 'สัปดาห์ถัดไป')
              : weekOffset === -1
                ? (lang === 'en' ? 'Last Week' : 'สัปดาห์ที่แล้ว')
                : (lang === 'en' ? `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}` : `สัปดาห์ ${weekOffset > 0 ? '+' : ''}${weekOffset}`)}
        </div>
      </div>

      {/* Mini Calendar + Views Layout */}
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="xl:w-[300px] shrink-0 space-y-6">
          <MiniCalendar
            schedule={combinedSchedule}
            lang={lang}
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
            weekDates={weekDates}
          />

          {todayClasses.length > 0 && (
            <div className="bg-white border border-[#D2D2D7]/80 rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-2">
                  <CalendarDays size={14} className="text-[#0071E3]" />
                  <span>{lang === 'en' ? "Today's Classes" : 'ตารางเรียนวันนี้'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => updateScheduleParams({ week: 0, day: todayKey, view: 'daily' })}
                  className="text-xs font-medium text-[#0071E3] hover:underline cursor-pointer"
                >
                  {lang === 'en' ? 'Jump to today' : 'ดูของวันนี้'}
                </button>
              </div>
              <div className="space-y-2.5">
                {todayClasses.map(cls => (
                  <div
                    key={cls.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F5F7]/70 border border-[#D2D2D7]/70 border-l-3"
                    style={{ borderLeftColor: resolveHexColor(cls.color) }}
                  >
                    <div className="flex flex-col items-center justify-center shrink-0 w-12 h-11 rounded-lg bg-white border border-[#D2D2D7] text-[#0071E3]">
                      <span className="text-[11px] font-semibold leading-none">{cls.startTime}</span>
                      <span className="text-[10px] text-[#6E6E73] mt-1 leading-none">{cls.endTime}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h4 className="text-xs font-semibold text-[#1D1D1F] truncate w-full" title={cls.title || cls.courseCode}>
                        {cls.title || cls.courseCode}
                      </h4>
                      {cls.room && (
                        <p className="text-[11px] text-[#6E6E73] truncate mt-0.5 flex items-center gap-1">
                          <MapPin size={10} className="shrink-0" />
                          <span>{cls.room}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {viewType === 'weekly' ? (
            <WeeklyGrid
              schedule={combinedSchedule}
              lang={lang}
              todayKey={todayKey}
              currentMinutes={currentMinutes}
              weekDates={weekDates}
              weekOffset={weekOffset}
              onClickBlock={openEditModal}
              onClickEmpty={openAddModal}
            />
          ) : (
            <DailyList
              schedule={combinedSchedule}
              lang={lang}
              todayKey={todayKey}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              weekDates={weekDates}
              onClickCard={openEditModal}
            />
          )}
        </div>
      </div>

      {isModalOpen && (
        <ScheduleModal
          key={editingEntry?.id || 'new'}
          isOpen={isModalOpen}
          entry={editingEntry ? editingEntry : modalEntry}
          visibleCourses={visibleCourses}
          schedule={schedule}
          lang={lang}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEntry(null);
            setPrefillData(null);
            setShowClearConfirm(false);
          }}
        />
      )}
    </div>
  );
}
