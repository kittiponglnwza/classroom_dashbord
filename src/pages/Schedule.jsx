import { useState, useEffect, useRef, useMemo, useCallback, useId, useContext } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarDays, CalendarX2, Plus, X, AlertTriangle, Clock,
  ChevronLeft, ChevronRight, MapPin, Upload, RefreshCw, MoreHorizontal,
  Trash2, Calendar as CalendarIcon, BookOpen, ClipboardCheck
} from 'lucide-react';
import { t } from '../utils/i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';
import { useAuth } from '../contexts/AuthContext';
import { ToastContext } from '../contexts/ToastContext';
import { useExams } from '../hooks/useExams';
import { calendarSyncManager } from '../services/CalendarSyncManager';
import { getToken } from '../utils/storage';
import { parseExamDate } from '../utils/examDate';
import { parseLocalDateInput } from '../utils/dateUtils';
import {
  resolveCourseEndDate,
  resolveCourseExamInfo,
  resolveEntryPauseRanges,
  isEntryPausedOnDate,
  isScheduleEntryActiveOnDate,
  formatCourseEndDateLabel,
} from '../utils/courseEndDate';
import RegImportModal from '../components/RegImportModal';
import PageHeader from '../components/PageHeader';
import { DAYS, JS_DAY_MAP } from '../constants/dateConstants';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

const DAY_KEYS = {
  mon: 'dayMon', tue: 'dayTue', wed: 'dayWed', thu: 'dayThu',
  fri: 'dayFri', sat: 'daySat', sun: 'daySun',
};
const DAY_SHORT_KEYS = {
  mon: 'dayMonShort', tue: 'dayTueShort', wed: 'dayWedShort', thu: 'dayThuShort',
  fri: 'dayFriShort', sat: 'daySatShort', sun: 'daySunShort',
};
const PRESET_COLORS = [
  '#3794FF', '#4EC9B0', '#CCA700', '#F14C4C', '#C586C0',
  '#007ACC', '#CE9178', '#569CD6', '#2D9D78', '#858585',
];

const COLOR_MAP = {
  emerald: '#4EC9B0',
  blue: '#3794FF',
  amber: '#CCA700',
  rose: '#F14C4C',
  purple: '#C586C0',
  zinc: '#858585',
  gray: '#858585',
  red: '#F14C4C',
  green: '#4EC9B0',
  orange: '#CE9178',
};

function resolveHexColor(colorStr) {
  if (!colorStr) return '#3794FF';
  if (colorStr.startsWith('#')) return colorStr;
  return COLOR_MAP[colorStr.toLowerCase()] || '#3794FF';
}

function addHoursToTime(timeStr, hours) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const parts = timeStr.split(/[:.]/).map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return '';
  const totalMinutes = Math.min(23 * 60 + 59, Math.max(0, parts[0] * 60 + parts[1] + Math.round(hours * 60)));
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function getTodayKey() {
  return JS_DAY_MAP[new Date().getDay()];
}

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeClockTime(raw, fallback = null) {
  if (!raw || typeof raw !== 'string') return fallback;
  const match = raw.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return fallback;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 24 || m < 0 || m > 59 || (h === 24 && m > 0)) return fallback;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(tStr) {
  if (!tStr || typeof tStr !== 'string') return 0;
  const parts = tStr.trim().split(/[:.]/).map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return 0;
  return parts[0] * 60 + parts[1];
}

function assignVerticalLanes(dayEntries) {
  const sorted = [...dayEntries].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const laneEndMinutes = [];
  const withLanes = sorted.map((entry) => {
    const startM = timeToMinutes(entry.startTime);
    const endM = Math.max(startM + 30, timeToMinutes(entry.endTime));
    let lane = laneEndMinutes.findIndex((end) => end <= startM);
    if (lane === -1) {
      lane = laneEndMinutes.length;
      laneEndMinutes.push(endM);
    } else {
      laneEndMinutes[lane] = endM;
    }
    return { ...entry, _lane: lane };
  });
  return { items: withLanes, laneCount: Math.max(1, laneEndMinutes.length) };
}

function hasConflict(entry, allEntries, excludeId = null) {
  const start = timeToMinutes(entry.startTime);
  const end = timeToMinutes(entry.endTime);
  return allEntries.some((e) => {
    if (e.id === excludeId || e.deletedAt || e.day !== entry.day) return false;
    if (e.date && entry.date && e.date !== entry.date) return false;
    const eEnd = e._effectiveEndDate || e.endDate;
    if (entry.date && !e.date && eEnd && entry.date > eEnd) return false;
    return start < timeToMinutes(e.endTime) && end > timeToMinutes(e.startTime);
  });
}

function getWeekDates(offset, lang) {
  const today = new Date();
  today.setDate(today.getDate() + offset * 7);
  const currentDay = today.getDay();
  const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayDiff);

  const map = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    map[DAYS[i]] = {
      dateStr: toLocalDateStr(d),
      dayNum: d.getDate(),
      month: d.getMonth(),
      year: d.getFullYear(),
      formatted: d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' }),
      dayName: d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { weekday: 'long' }),
    };
  }
  return map;
}

function getMonthHeaderLabel(weekDates, lang) {
  const mon = weekDates?.mon;
  const sun = weekDates?.sun;
  if (!mon || !sun) return '';
  const monthsTh = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const list = lang === 'th' ? monthsTh : monthsEn;
  const yr = lang === 'th' ? mon.year + 543 : mon.year;
  if (mon.month === sun.month) {
    return `${list[mon.month]} ${yr}`;
  }
  return `${list[mon.month].slice(0, 3)} – ${list[sun.month].slice(0, 3)} ${yr}`;
}

function filterOutExamConflicts(regularEntries, examEntries) {
  if (!examEntries.length) return regularEntries;
  return regularEntries.filter((reg) => {
    return !examEntries.some((exam) => {
      if (exam.day !== reg.day) return false;
      const codeMatch = reg.courseCode && exam.courseCode &&
        reg.courseCode.toLowerCase().trim() === exam.courseCode.toLowerCase().trim();
      const titleMatch = reg.title && exam.title &&
        reg.title.toLowerCase().trim() === exam.title.toLowerCase().trim();
      if (codeMatch || titleMatch) return true;
      return timeToMinutes(reg.startTime) < timeToMinutes(exam.endTime) &&
        timeToMinutes(reg.endTime) > timeToMinutes(exam.startTime);
    });
  });
}

// ─── MINI CALENDAR POPOVER ─────────────────────────────────────────
function MiniCalendarPopover({ schedule, lang, weekOffset, setWeekOffset, weekDates, onClose }) {
  const [currentDate, setCurrentDate] = useState(() => {
    if (weekDates?.mon?.dateStr) {
      const [yy, mm] = weekDates.mon.dateStr.split('-').map(Number);
      return new Date(yy, mm - 1, 1);
    }
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = (() => {
    const d = new Date(year, month, 1).getDay();
    return d === 0 ? 6 : d - 1;
  })();

  const monthNames = lang === 'en'
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const dayNames = lang === 'en' ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const todayStr = toLocalDateStr(new Date());

  const handleDayClick = (dayNum) => {
    const clickedDate = new Date(year, month, dayNum);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getMon = (d) => {
      const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
      const res = new Date(d);
      res.setDate(d.getDate() + diff);
      return res;
    };
    const diffWeeks = Math.round((getMon(clickedDate).getTime() - getMon(today).getTime()) / (7 * 86400000));
    setWeekOffset(diffWeeks);
    onClose?.();
  };

  const hasEntriesOnDay = (dayNum) => {
    const dObj = new Date(year, month, dayNum);
    const dateStr = toLocalDateStr(dObj);
    const dayKey = JS_DAY_MAP[dObj.getDay()];
    return schedule.some((e) => {
      if (e.isExam || e.isAssignment || e.date) {
        return e.date === dateStr && !(e.deletedAt && dateStr >= e.deletedAt);
      }
      return e.day === dayKey && isScheduleEntryActiveOnDate(e, dateStr);
    });
  };

  return (
    <div className="absolute left-0 top-full mt-2 z-40 w-72 bg-[#252526] border border-[#3C3C3C] rounded-2xl p-4 shadow-2xl">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-semibold text-[#FFFFFF]">
          {monthNames[month]} {lang === 'th' ? year + 543 : year}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            aria-label="Previous month"
            className="p-1 rounded-lg hover:bg-[#2A2D2E] text-[#9D9D9D] hover:text-[#FFFFFF] cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            aria-label="Next month"
            className="p-1 rounded-lg hover:bg-[#2A2D2E] text-[#9D9D9D] hover:text-[#FFFFFF] cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-[#858585] py-0.5">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dateStr = toLocalDateStr(new Date(year, month, dayNum));
          const isToday = dateStr === todayStr;
          const isSelectedWeek = weekDates && Object.values(weekDates).some((w) => w.dateStr === dateStr);
          const hasDot = hasEntriesOnDay(dayNum);

          return (
            <button
              key={dayNum}
              type="button"
              onClick={() => handleDayClick(dayNum)}
              className={`relative h-8 rounded-lg flex items-center justify-center text-xs transition-colors cursor-pointer ${
                isToday
                  ? 'bg-[#007ACC] text-white font-semibold'
                  : isSelectedWeek
                    ? 'bg-[#2D2D2D] text-[#FFFFFF] font-medium'
                    : 'text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E]'
              }`}
            >
              <span>{dayNum}</span>
              {hasDot && !isToday && (
                <span className="w-1 h-1 rounded-full bg-[#3794FF] absolute bottom-1" />
              )}
            </button>
          );
        })}
      </div>

      {weekOffset !== 0 && (
        <button
          type="button"
          onClick={() => {
            setWeekOffset(0);
            onClose?.();
          }}
          className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-medium bg-[#1E1E1E] border border-[#3C3C3C] text-[#3794FF] hover:bg-[#2A2D2E] cursor-pointer"
        >
          {lang === 'th' ? 'กลับไปสัปดาห์นี้' : 'Jump to Today'}
        </button>
      )}
    </div>
  );
}

// ─── MINIMAL WEEKLY TIMETABLE GRID ─────────────────────────────────
function WeeklyGrid({
  schedule, lang, todayKey, currentMinutes, weekDates, weekOffset,
  visibleDays, startHour, endHour, onClickBlock, onClickEmpty
}) {
  const totalHours = Math.max(1, endHour - startHour);
  const timeLabels = [];
  for (let h = startHour; h < endHour; h++) {
    timeLabels.push(`${String(h).padStart(2, '0')}:00`);
  }

  const timeToPct = useCallback((timeStr) => {
    if (!timeStr) return 0;
    const mins = timeToMinutes(timeStr);
    return Math.min(Math.max(((mins - startHour * 60) / (totalHours * 60)) * 100, 0), 100);
  }, [startHour, totalHours]);

  const entriesByDay = useMemo(() => {
    const map = {};
    DAYS.forEach((d) => { map[d] = []; });

    const activeExams = [];
    const activeRegular = [];
    const activeAssigns = [];

    schedule.forEach((entry) => {
      const dayDateStr = weekDates[entry.day]?.dateStr;
      if (!dayDateStr) return;
      if (!isScheduleEntryActiveOnDate(entry, dayDateStr)) return;
      if (entry.isExam) {
        activeExams.push(entry);
      } else if (entry.isAssignment) {
        activeAssigns.push(entry);
      } else {
        activeRegular.push(entry);
      }
    });

    const filteredRegular = filterOutExamConflicts(activeRegular, activeExams);
    [...filteredRegular, ...activeExams, ...activeAssigns].forEach((entry) => {
      if (map[entry.day]) map[entry.day].push(entry);
    });
    return map;
  }, [schedule, weekDates]);

  const handleRowClick = useCallback((day, e) => {
    if (e.target.closest('[data-schedule-block]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let startTime = '09:00';
    let endTime = '10:00';
    if (rect && rect.width > 0 && Number.isFinite(e.clientX)) {
      const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left));
      const minutes = startHour * 60 + (x / rect.width) * (totalHours * 60);
      const rounded = Math.min(22 * 60 + 30, Math.max(startHour * 60, Math.round(minutes / 30) * 30));
      startTime = `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
      const endMins = Math.min(23 * 60 + 59, rounded + 60);
      endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
    }
    onClickEmpty(day, startTime, endTime, weekDates[day]?.dateStr || '');
  }, [onClickEmpty, weekDates, startHour, totalHours]);

  const nowPct = currentMinutes !== null && weekOffset === 0
    ? ((currentMinutes - startHour * 60) / (totalHours * 60)) * 100
    : null;
  const showNowLine = nowPct !== null && nowPct >= 0 && nowPct <= 100;

  return (
    <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[740px] w-full">
          {/* Clean Time Header */}
          <div className="grid grid-cols-[96px_1fr] border-b border-[#3C3C3C] bg-[#1E1E1E]/60">
            <div className="px-3 py-2.5 text-[11px] font-medium text-[#858585] flex items-center justify-center border-r border-[#3C3C3C] select-none">
              {lang === 'en' ? 'Day' : 'วัน'}
            </div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${totalHours}, minmax(0, 1fr))` }}>
              {timeLabels.map((label) => (
                <div
                  key={label}
                  className="py-2.5 px-1 text-left pl-2 border-l border-[#3C3C3C]/50 text-[10px] font-mono text-[#858585] select-none"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Day Rows */}
          <div className="divide-y divide-[#3C3C3C]/70">
            {visibleDays.map((day) => {
              const isToday = day === todayKey && weekOffset === 0;
              const { items: laneEntries, laneCount } = assignVerticalLanes(entriesByDay[day] || []);
              const rowMinHeight = Math.max(82, laneCount * 58);

              return (
                <div
                  key={day}
                  className="grid grid-cols-[96px_1fr]"
                  style={{ minHeight: `${rowMinHeight}px` }}
                >
                  {/* Day Label Cell */}
                  <div
                    className={`px-3 py-3 border-r border-[#3C3C3C] flex flex-col items-center justify-center select-none ${
                      isToday ? 'bg-[#007ACC]/10' : 'bg-[#252526]'
                    }`}
                  >
                    <span className={`text-xs font-semibold ${isToday ? 'text-[#3794FF]' : 'text-[#D4D4D4]'}`}>
                      {t(DAY_SHORT_KEYS[day], lang)}
                    </span>
                    <span
                      className={`mt-1 text-[11px] font-mono px-2 py-0.5 rounded-full ${
                        isToday ? 'bg-[#007ACC] text-white font-semibold' : 'text-[#858585]'
                      }`}
                    >
                      {weekDates[day].dayNum}
                    </span>
                  </div>

                  {/* Interactive Timeline Track */}
                  <div
                    className={`relative cursor-pointer transition-colors ${
                      isToday ? 'bg-[#007ACC]/[0.04] hover:bg-[#007ACC]/[0.07]' : 'bg-[#1E1E1E] hover:bg-[#232325]'
                    }`}
                    onClick={(e) => handleRowClick(day, e)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t(DAY_KEYS[day], lang)} timetable row - add class`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onClickEmpty(day, '09:00', '10:00', weekDates[day].dateStr);
                      }
                    }}
                  >
                    {/* Subtle hourly vertical gridlines */}
                    <div
                      className="absolute inset-0 grid pointer-events-none"
                      style={{ gridTemplateColumns: `repeat(${totalHours}, minmax(0, 1fr))` }}
                    >
                      {Array.from({ length: totalHours }).map((_, idx) => (
                        <div key={idx} className="border-l border-[#3C3C3C]/35 h-full" />
                      ))}
                    </div>

                    {/* Class / Exam / Assignment Blocks */}
                    {laneEntries.map((entry) => {
                      const rawStart = timeToPct(entry.startTime);
                      const rawEnd = timeToPct(entry.endTime);
                      const left = Math.min(Math.max(rawStart, 0), 96);
                      const right = Math.min(Math.max(rawEnd, left + 3), 100);
                      const width = Math.max(right - left, 3);

                      const accentHex = resolveHexColor(entry.color);
                      const isAssign = Boolean(entry.isAssignment);
                      const isExam = Boolean(entry.isExam);
                      const topPct = (entry._lane / laneCount) * 100 + 8 / laneCount;
                      const heightPct = 100 / laneCount - 16 / laneCount;

                      const effectiveEnd = !isExam && !isAssign && !entry.date
                        ? (entry._effectiveEndDate || entry.endDate || '')
                        : '';
                      const endDateNote = effectiveEnd
                        ? (lang === 'th'
                            ? `ปิดคอร์ส ${formatCourseEndDateLabel(effectiveEnd, 'th', { withYear: true })}`
                            : `Ends ${formatCourseEndDateLabel(effectiveEnd, 'en', { withYear: true })}`)
                        : '';

                      const tooltipText = [
                        entry.title,
                        entry.courseCode,
                        `${entry.startTime}–${entry.endTime}`,
                        entry.room,
                        endDateNote,
                        entry.notes,
                      ].filter(Boolean).join(' • ');

                      return (
                        <div
                          key={entry.id}
                          data-schedule-block
                          title={tooltipText}
                          onClick={(e) => {
                            e.stopPropagation();
                            onClickBlock(entry, weekDates[day].dateStr);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onClickBlock(entry, weekDates[day].dateStr);
                            }
                          }}
                          className="absolute rounded-xl overflow-hidden cursor-pointer transition-all hover:brightness-115 flex flex-col justify-center px-2.5 py-1.5"
                          style={{
                            left: `calc(${left}% + 2px)`,
                            width: `calc(${width}% - 4px)`,
                            top: `${topPct}%`,
                            height: `${heightPct}%`,
                            backgroundColor: `${accentHex}1A`,
                            border: `1px solid ${accentHex}45`,
                            borderLeft: `3px solid ${accentHex}`,
                            zIndex: isAssign ? 20 : isExam ? 15 : 10,
                          }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isExam && (
                              <span className="text-[9px] font-semibold uppercase px-1.5 py-0.25 rounded bg-rose-500/25 text-rose-300 shrink-0">
                                {lang === 'th' ? 'สอบ' : 'Exam'}
                              </span>
                            )}
                            {isAssign && (
                              <span className="text-[9px] font-semibold uppercase px-1.5 py-0.25 rounded bg-purple-500/25 text-purple-300 shrink-0">
                                {lang === 'th' ? 'งาน' : 'Due'}
                              </span>
                            )}
                            <span className="text-xs font-semibold text-[#FFFFFF] truncate leading-tight">
                              {entry.title || entry.courseCode}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10.5px] text-[#B5B5B5] mt-0.5 truncate font-mono">
                            <span className="shrink-0">
                              {isAssign ? `${entry.endTime}` : `${entry.startTime}–${entry.endTime}`}
                            </span>
                            {entry.room && !isAssign && (
                              <>
                                <span className="text-[#666]">•</span>
                                <span className="truncate font-sans text-[#CCCCCC]">{entry.room}</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Current Time Indicator */}
                    {isToday && showNowLine && (
                      <div
                        className="absolute top-0 bottom-0 z-25 pointer-events-none flex flex-col items-center"
                        style={{ left: `${nowPct}%` }}
                      >
                        <div className="w-2 h-2 rounded-full bg-rose-500 -mt-1 shrink-0" />
                        <div className="flex-1 w-[1.5px] bg-rose-500/85" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MINIMAL DAILY TIMELINE VIEW ───────────────────────────────────
function DailyList({ schedule, lang, todayKey, selectedDay, setSelectedDay, weekDates, onClickCard, onClickAdd }) {
  const dayEntries = useMemo(() => {
    const dayExams = [];
    const dayRegular = [];
    const dayAssigns = [];
    const targetDate = weekDates[selectedDay]?.dateStr;

    schedule.forEach((e) => {
      if (e.day !== selectedDay) return;
      if (!targetDate || !isScheduleEntryActiveOnDate(e, targetDate)) return;
      if (e.isExam) {
        dayExams.push(e);
      } else if (e.isAssignment) {
        dayAssigns.push(e);
      } else {
        dayRegular.push(e);
      }
    });

    const filteredRegular = filterOutExamConflicts(dayRegular, dayExams);
    return [...filteredRegular, ...dayExams, ...dayAssigns]
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [schedule, selectedDay, weekDates]);

  const countForDay = useCallback((day) => {
    const dateStr = weekDates[day]?.dateStr;
    if (!dateStr) return 0;
    return schedule.filter((e) => e.day === day && isScheduleEntryActiveOnDate(e, dateStr)).length;
  }, [schedule, weekDates]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Clean 7-Day Selector Pill Strip */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {DAYS.map((day) => {
          const isSelected = selectedDay === day;
          const isToday = day === todayKey;
          const count = countForDay(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`py-2 px-1 sm:py-2.5 sm:px-2 rounded-xl flex flex-col items-center justify-center transition-colors border cursor-pointer ${
                isSelected
                  ? 'bg-[#007ACC] text-white border-[#007ACC]'
                  : isToday
                    ? 'bg-[#007ACC]/15 text-[#3794FF] border-[#007ACC]/40'
                    : 'bg-[#252526] text-[#9D9D9D] border-[#3C3C3C] hover:text-[#FFFFFF] hover:bg-[#2A2D2E]'
              }`}
            >
              <span className="text-[10.5px] sm:text-[11px] font-medium">{t(DAY_SHORT_KEYS[day], lang)}</span>
              <span className="text-xs sm:text-sm font-semibold font-mono mt-0.5">{weekDates[day].dayNum}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full mt-1 ${
                  count > 0 ? (isSelected ? 'bg-white' : 'bg-[#3794FF]') : 'bg-transparent'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Day Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-[#FFFFFF] truncate">{weekDates[selectedDay].dayName}</h2>
          <span className="text-xs text-[#858585] shrink-0">{weekDates[selectedDay].formatted}</span>
        </div>
        <button
          type="button"
          onClick={() => onClickAdd(selectedDay, '09:00', '10:00', weekDates[selectedDay].dateStr)}
          className="text-xs text-[#3794FF] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Plus size={13} />
          <span>{lang === 'th' ? 'เพิ่มคาบวันนี้' : 'Add to this day'}</span>
        </button>
      </div>

      {/* Vertical Minimalist Timeline */}
      {dayEntries.length > 0 ? (
        <div className="space-y-2.5">
          {dayEntries.map((entry) => {
            const accentHex = resolveHexColor(entry.color);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onClickCard(entry, weekDates[selectedDay].dateStr)}
                className="w-full text-left bg-[#252526] hover:bg-[#2A2D2E] border border-[#3C3C3C] hover:border-[#007ACC]/60 rounded-2xl p-3 sm:p-4 transition-colors flex items-center gap-2.5 sm:gap-4 group cursor-pointer"
              >
                {/* Time Column */}
                <div className="w-13 sm:w-16 shrink-0 text-right font-mono">
                  <div className="text-xs font-semibold text-[#FFFFFF]">{entry.startTime}</div>
                  <div className="text-[11px] text-[#858585] mt-0.5">{entry.endTime}</div>
                </div>

                {/* Vertical Color Pill */}
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: accentHex }} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#FFFFFF] group-hover:text-[#3794FF] transition-colors truncate">
                      {entry.title}
                    </span>
                    {entry.courseCode && (
                      <span className="text-[10.5px] font-mono text-[#9D9D9D] bg-[#1E1E1E] border border-[#3C3C3C] px-2 py-0.5 rounded-md">
                        {entry.courseCode}
                      </span>
                    )}
                    {entry.isExam && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        {lang === 'th' ? 'สอบ' : 'Exam'}
                      </span>
                    )}
                    {entry.isAssignment && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        {lang === 'th' ? 'กำหนดส่ง' : 'Due'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#9D9D9D] flex-wrap">
                    {entry.room && (
                      <span className="inline-flex items-center gap-1 text-[#CCCCCC]">
                        <MapPin size={12} className="text-[#858585]" />
                        <span>{entry.room}</span>
                      </span>
                    )}
                    {!entry.isExam && !entry.isAssignment && !entry.date && (entry._effectiveEndDate || entry.endDate) && (
                      <span className="text-[11px] text-[#858585]">
                        {lang === 'th'
                          ? `ปิดคอร์ส ${formatCourseEndDateLabel(entry._effectiveEndDate || entry.endDate, 'th')}`
                          : `Ends ${formatCourseEndDateLabel(entry._effectiveEndDate || entry.endDate, 'en')}`}
                      </span>
                    )}
                    {entry.notes && (
                      <span className="text-[11px] text-[#858585] truncate max-w-md">{entry.notes}</span>
                    )}
                  </div>
                </div>

                <ChevronRight size={15} className="text-[#858585] group-hover:text-[#3794FF] shrink-0" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#252526] border border-[#3C3C3C] border-dashed rounded-2xl py-12 px-6 text-center space-y-2">
          <CalendarX2 size={28} className="text-[#858585] mx-auto opacity-60" />
          <p className="text-xs text-[#9D9D9D] font-medium">{t('noClasses', lang)}</p>
        </div>
      )}
    </div>
  );
}

// ─── ADD / EDIT SCHEDULE MODAL ─────────────────────────────────────
function ScheduleModal({ isOpen, entry, visibleCourses, schedule, allExams = [], lang, onSave, onDelete, onClose }) {
  const isEdit = Boolean(entry?.id);
  const titleId = useId();
  const codeId = useId();
  const dateId = useId();
  const endDateId = useId();
  const dayId = useId();
  const startTimeId = useId();
  const endTimeId = useId();
  const roomId = useId();
  const notesId = useId();

  const initialEndDate = entry?.noAutoEndDate ? '' : (entry?.endDate || entry?._effectiveEndDate || '');

  const [formData, setFormData] = useState({
    title: entry?.title || '',
    courseCode: entry?.courseCode || '',
    courseId: entry?.courseId || '',
    day: entry?.day || 'mon',
    date: entry?.date || '',
    endDate: initialEndDate,
    startTime: entry?.startTime || '09:00',
    endTime: entry?.endTime || '10:00',
    room: entry?.room || '',
    color: entry?.color || PRESET_COLORS[0],
    notes: entry?.notes || '',
  });

  const [classType, setClassType] = useState(entry?.id && entry?.date ? 'one-off' : 'recurring');
  const [userClearedEndDate, setUserClearedEndDate] = useState(Boolean(entry?.noAutoEndDate));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const update = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const autoEndInfo = useMemo(() => {
    if (classType !== 'recurring') return { endDate: '', source: 'none', examDate: '' };
    return resolveCourseExamInfo(
      {
        ...entry,
        courseCode: formData.courseCode,
        date: '',
        endDate: '',
        noAutoEndDate: false,
      },
      allExams
    );
  }, [classType, entry, formData.courseCode, allExams]);

  const modalPauseRanges = useMemo(() => {
    if (classType !== 'recurring') return [];
    return resolveEntryPauseRanges(
      {
        ...entry,
        courseCode: formData.courseCode,
        date: '',
        _pauseRangesResolved: false,
      },
      allExams
    );
  }, [classType, entry, formData.courseCode, allExams]);

  const handleEndDateChange = (nextVal) => {
    update('endDate', nextVal);
    if (!nextVal) {
      setUserClearedEndDate(true);
    } else {
      setUserClearedEndDate(false);
    }
  };

  const handleCourseSelect = (e) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setFormData((prev) => ({ ...prev, title: '', courseCode: '', courseId: '' }));
    } else {
      const course = visibleCourses.find((c) => c.id === val);
      if (course) {
        setFormData((prev) => ({
          ...prev,
          title: course.name,
          courseCode: course.code || '',
          courseId: course.id,
          color: resolveHexColor(course.color || prev.color),
        }));
      }
    }
  };

  const handleDateChange = (dateVal) => {
    update('date', dateVal);
    if (dateVal) {
      const [yy, mm, dd] = dateVal.split('-').map(Number);
      const d = new Date(yy, mm - 1, dd);
      update('day', JS_DAY_MAP[d.getDay()]);
    }
  };

  const handleTypeChange = (type) => {
    setClassType(type);
    if (type === 'recurring') {
      update('date', '');
    } else {
      handleDateChange(toLocalDateStr(new Date()));
    }
  };

  const conflict = useMemo(() => {
    if (!formData.startTime || !formData.endTime) return false;
    if (timeToMinutes(formData.endTime) <= timeToMinutes(formData.startTime)) return false;
    return hasConflict(formData, schedule, entry?.id || null);
  }, [formData, schedule, entry?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    if (timeToMinutes(formData.endTime) <= timeToMinutes(formData.startTime)) {
      setTimeError(t('invalidTimeRange', lang));
      return;
    }
    setTimeError('');
    const trimmedEndDate = classType === 'recurring' ? (formData.endDate || '').trim() : '';
    const disableAutoEnd = classType === 'recurring' && !trimmedEndDate && userClearedEndDate;
    onSave({
      ...(entry?.id ? { id: entry.id } : {}),
      ...(entry?.source ? { source: entry.source } : {}),
      title: formData.title.trim(),
      courseCode: formData.courseCode.trim(),
      courseId: formData.courseId || '',
      day: formData.day,
      date: classType === 'one-off' ? formData.date : '',
      endDate: trimmedEndDate,
      ...(disableAutoEnd ? { noAutoEndDate: true } : { noAutoEndDate: false }),
      startTime: formData.startTime,
      endTime: formData.endTime,
      room: formData.room.trim(),
      color: formData.color,
      notes: formData.notes.trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? t('editSchedule', lang) : t('addSchedule', lang)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto shadow-2xl">
        <div className="px-5 py-4 border-b border-[#3C3C3C] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#FFFFFF]">
            {isEdit ? t('editSchedule', lang) : t('addSchedule', lang)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cancelBtn', lang)}
            className="p-1.5 rounded-lg text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {visibleCourses.length > 0 && (
            <div>
              <label className="block text-[11px] font-medium text-[#9D9D9D] mb-1">
                {t('selectCourse', lang)}
              </label>
              <select
                value={formData.courseId || '__custom__'}
                onChange={handleCourseSelect}
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#D4D4D4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
              >
                <option value="__custom__">{t('customEntry', lang)}</option>
                {visibleCourses.map((c) => (
                  <option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label htmlFor={titleId} className="block text-[11px] font-medium text-[#9D9D9D] mb-1">
                {t('courseName', lang)} *
              </label>
              <input
                id={titleId}
                type="text"
                required
                value={formData.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder={lang === 'th' ? 'เช่น Data Structure' : 'e.g. Data Structure'}
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#FFFFFF] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
              />
            </div>
            <div>
              <label htmlFor={codeId} className="block text-[11px] font-medium text-[#9D9D9D] mb-1">
                {t('courseCodeLabel', lang)}
              </label>
              <input
                id={codeId}
                type="text"
                value={formData.courseCode}
                onChange={(e) => update('courseCode', e.target.value)}
                placeholder="040613..."
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#FFFFFF] placeholder-[#858585] font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className="block text-[11px] font-medium text-[#9D9D9D] mb-1">{t('classType', lang)}</span>
              <div className="grid grid-cols-2 bg-[#1E1E1E] border border-[#3C3C3C] p-0.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleTypeChange('recurring')}
                  className={`py-1.5 rounded-lg text-[11px] font-medium cursor-pointer ${
                    classType === 'recurring' ? 'bg-[#007ACC] text-white' : 'text-[#9D9D9D]'
                  }`}
                >
                  {lang === 'th' ? 'ทุกสัปดาห์' : 'Weekly'}
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('one-off')}
                  className={`py-1.5 rounded-lg text-[11px] font-medium cursor-pointer ${
                    classType === 'one-off' ? 'bg-[#007ACC] text-white' : 'text-[#9D9D9D]'
                  }`}
                >
                  {lang === 'th' ? 'ระบุวัน' : 'Once'}
                </button>
              </div>
            </div>

            {classType === 'recurring' ? (
              <div>
                <label htmlFor={dayId} className="block text-[11px] font-medium text-[#9D9D9D] mb-1">
                  {lang === 'th' ? 'วันเรียน' : 'Day'}
                </label>
                <select
                  id={dayId}
                  value={formData.day}
                  onChange={(e) => update('day', e.target.value)}
                  className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#FFFFFF]"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{t(DAY_KEYS[d], lang)}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label htmlFor={dateId} className="block text-[11px] font-medium text-[#9D9D9D] mb-1">
                  {t('selectDate', lang)}
                </label>
                <input
                  id={dateId}
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#FFFFFF]"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor={startTimeId} className="block text-[11px] font-medium text-[#9D9D9D] mb-1">
                {t('startTime', lang)}
              </label>
              <input
                id={startTimeId}
                type="time"
                required
                value={formData.startTime}
                onChange={(e) => {
                  setTimeError('');
                  update('startTime', e.target.value);
                }}
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#FFFFFF] font-mono"
              />
            </div>
            <div>
              <label htmlFor={endTimeId} className="block text-[11px] font-medium text-[#9D9D9D] mb-1">
                {t('endTime', lang)}
              </label>
              <input
                id={endTimeId}
                type="time"
                required
                value={formData.endTime}
                onChange={(e) => {
                  setTimeError('');
                  update('endTime', e.target.value);
                }}
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#FFFFFF] font-mono"
              />
            </div>
          </div>

          {/* Quick Duration Chips */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-[#858585]">{lang === 'th' ? 'ระยะเวลา:' : 'Duration:'}</span>
            {[1, 2, 3].map((hrs) => (
              <button
                key={hrs}
                type="button"
                onClick={() => {
                  setTimeError('');
                  update('endTime', addHoursToTime(formData.startTime, hrs));
                }}
                className="px-2 py-0.5 rounded-md bg-[#1E1E1E] border border-[#3C3C3C] text-[#D4D4D4] hover:border-[#007ACC] cursor-pointer"
              >
                +{hrs}h
              </button>
            ))}
          </div>

          {classType === 'recurring' && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor={endDateId} className="block text-[11px] font-medium text-[#9D9D9D]">
                  {lang === 'th' ? 'วันปิดคอร์ส (ไม่บังคับ)' : 'Course End Date (Optional)'}
                </label>
                <div className="flex items-center gap-2 text-[10.5px]">
                  {autoEndInfo.endDate && formData.endDate !== autoEndInfo.endDate && (
                    <button
                      type="button"
                      onClick={() => handleEndDateChange(autoEndInfo.endDate)}
                      className="text-[#3794FF] hover:underline cursor-pointer"
                    >
                      {lang === 'th' ? 'ก่อนสอบ 1 สัปดาห์' : '1w before exam'}
                    </button>
                  )}
                  {formData.endDate && (
                    <button
                      type="button"
                      onClick={() => handleEndDateChange('')}
                      className="text-[#858585] hover:text-rose-400 cursor-pointer"
                    >
                      {lang === 'th' ? 'ล้าง' : 'Clear'}
                    </button>
                  )}
                </div>
              </div>
              <input
                id={endDateId}
                type="date"
                value={formData.endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#FFFFFF] font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
              />
              <p className="text-[10.5px] text-[#858585] mt-1">
                {autoEndInfo.source === 'course-exam' && autoEndInfo.examDate
                  ? (lang === 'th'
                      ? `ปิดคอร์สอัตโนมัติก่อนสอบปลายภาค 1 สัปดาห์ (สอบ ${formatCourseEndDateLabel(autoEndInfo.examDate, 'th', { withYear: true })})`
                      : `Auto-closes 1 week before final exam (Exam ${formatCourseEndDateLabel(autoEndInfo.examDate, 'en', { withYear: true })})`)
                  : autoEndInfo.source === 'semester-finals' && autoEndInfo.examDate
                    ? (lang === 'th'
                        ? `ปิดคอร์สอัตโนมัติก่อนช่วงสอบปลายภาค 1 สัปดาห์ (เริ่มสอบ ${formatCourseEndDateLabel(autoEndInfo.examDate, 'th', { withYear: true })})`
                        : `Auto-closes 1 week before finals week (Starts ${formatCourseEndDateLabel(autoEndInfo.examDate, 'en', { withYear: true })})`)
                    : (lang === 'th'
                        ? 'หยุดแสดงวิชานี้หลังวันปิดคอร์สทั้งในเว็บและ Google Calendar'
                        : 'Stops repeating after this date in both app & Google Calendar')}
              </p>
              {modalPauseRanges.length > 0 && (
                <p className="text-[10.5px] text-amber-300/80 mt-0.5">
                  {lang === 'th'
                    ? `งดเรียนช่วงสอบกลางภาค ${formatCourseEndDateLabel(modalPauseRanges[0].start, 'th')} – ${formatCourseEndDateLabel(modalPauseRanges[0].end, 'th', { withYear: true })} แล้วกลับมาเรียนต่อปกติ`
                    : `Pauses for Midterm week (${formatCourseEndDateLabel(modalPauseRanges[0].start, 'en')} – ${formatCourseEndDateLabel(modalPauseRanges[0].end, 'en', { withYear: true })}), then resumes normally`}
                </p>
              )}
            </div>
          )}

          {timeError && (
            <div role="alert" className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{timeError}</span>
            </div>
          )}

          {conflict && !timeError && (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{t('timeConflict', lang)}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor={roomId} className="block text-[11px] font-medium text-[#9D9D9D] mb-1">
                {t('classRoomLabel', lang)}
              </label>
              <input
                id={roomId}
                type="text"
                value={formData.room}
                onChange={(e) => update('room', e.target.value)}
                placeholder="78-621"
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#FFFFFF] placeholder-[#858585]"
              />
            </div>
            <div>
              <span className="block text-[11px] font-medium text-[#9D9D9D] mb-1.5">{t('colorLabel', lang)}</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update('color', c)}
                    aria-label={`Select color ${c}`}
                    className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                      formData.color === c ? 'ring-2 ring-white scale-110' : 'opacity-75 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor={notesId} className="block text-[11px] font-medium text-[#9D9D9D] mb-1">
              {t('scheduleNotes', lang)}
            </label>
            <input
              id={notesId}
              type="text"
              value={formData.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder={lang === 'th' ? 'ชื่ออาจารย์ / หมายเหตุเพิ่มเติม...' : 'Instructor or notes...'}
              className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#D4D4D4] placeholder-[#858585]"
            />
          </div>

          <div className="pt-2 border-t border-[#3C3C3C] flex items-center justify-between gap-2">
            {isEdit ? (
              showDeleteConfirm ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onDelete(entry.id)}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-rose-600 text-white cursor-pointer"
                  >
                    {t('confirmBtn', lang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2.5 py-2 rounded-xl text-xs bg-[#1E1E1E] border border-[#3C3C3C] text-[#D4D4D4] cursor-pointer"
                  >
                    {t('cancelBtn', lang)}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>{t('deleteSchedule', lang)}</span>
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[#1E1E1E] border border-[#3C3C3C] text-[#D4D4D4] hover:bg-[#2A2D2E] cursor-pointer"
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
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN MINIMALIST SCHEDULE PAGE ─────────────────────────────────
export default function Schedule() {
  const { lang } = useSettings();
  const { profile, accessToken } = useAuth();
  const toast = useContext(ToastContext);
  const {
    schedule, handleSaveScheduleEntry, handleDeleteScheduleEntry,
    handleClearSchedule, extensionStatus, requestExtensionSync
  } = useClassroom();
  const ui = useClassroomUI();
  const visibleCourses = useMemo(() => ui?.visibleCourses || [], [ui?.visibleCourses]);
  const visibleAssignments = useMemo(() => ui?.visibleAssignments || [], [ui?.visibleAssignments]);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isTh = lang === 'th';
  const todayKey = getTodayKey();
  const isCompactViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  const defaultViewType = isCompactViewport ? 'daily' : 'weekly';
  const viewType = searchParams.get('view') || defaultViewType;
  const rawSelectedDay = searchParams.get('day') || todayKey;
  const selectedDay = DAYS.includes(rawSelectedDay) ? rawSelectedDay : todayKey;
  const weekOffset = parseInt(searchParams.get('week') || '0', 10) || 0;

  const updateScheduleParams = useCallback((updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === undefined || (k === 'view' && v === defaultViewType) || (k === 'week' && Number(v) === 0)) {
          next.delete(k);
        } else {
          next.set(k, String(v));
        }
      });
      return next;
    }, { replace: true });
  }, [setSearchParams, defaultViewType]);

  const setViewType = useCallback((v) => updateScheduleParams({ view: v }), [updateScheduleParams]);
  const setSelectedDay = useCallback((d) => updateScheduleParams({ day: d }), [updateScheduleParams]);
  const setWeekOffset = useCallback((updater) => {
    const nextVal = typeof updater === 'function' ? updater(weekOffset) : updater;
    updateScheduleParams({ week: nextVal });
  }, [updateScheduleParams, weekOffset]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegImportOpen, setIsRegImportOpen] = useState(false);
  const [isMiniCalOpen, setIsMiniCalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showExamsLayer, setShowExamsLayer] = useState(true);
  const [showAssignmentsLayer, setShowAssignmentsLayer] = useState(true);
  const [showWeekendOverride, setShowWeekendOverride] = useState(false);
  const [calSyncState, setCalSyncState] = useState(calendarSyncManager.state);

  const miniCalRef = useRef(null);
  const moreMenuRef = useRef(null);

  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => calendarSyncManager.subscribe((st) => setCalSyncState(st)), []);

  useEffect(() => {
    const handleOutside = (e) => {
      if (miniCalRef.current && !miniCalRef.current.contains(e.target)) setIsMiniCalOpen(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setIsMoreMenuOpen(false);
        setShowClearConfirm(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const activeEmail = (profile?.email || '').toLowerCase().trim();
  const { allExams } = useExams(activeEmail, lang, schedule, profile?.studentId);

  const examScheduleEntries = useMemo(() => {
    return allExams.map((ex) => {
      let startTime = '09:00';
      let endTime = '12:00';
      if (ex.time && typeof ex.time === 'string') {
        const parts = ex.time.split(/[-–]/).map((s) => normalizeClockTime(s));
        if (parts.length === 2 && parts[0] && parts[1]) {
          startTime = parts[0];
          endTime = parts[1];
        }
      }
      let dateVal = '';
      if (typeof ex.rawIsoDate === 'string') {
        const isoPrefix = ex.rawIsoDate.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(isoPrefix)) dateVal = isoPrefix;
      }
      if (!dateVal && ex.date) {
        const parsed = parseExamDate(ex.date);
        if (parsed) dateVal = toLocalDateStr(parsed);
      }
      if (!dateVal) return null;
      const [ey, em, ed] = dateVal.split('-').map(Number);
      const d = new Date(ey, em - 1, ed);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== ey || d.getMonth() !== em - 1 || d.getDate() !== ed) {
        return null;
      }
      return {
        id: `exam-${ex.id}`,
        title: ex.subjectName || ex.courseName || 'Exam',
        courseCode: ex.subjectCode || ex.courseCode || '',
        day: JS_DAY_MAP[d.getDay()],
        date: dateVal,
        startTime,
        endTime,
        room: ex.room ? `${ex.room}${ex.seat ? ` (${ex.seat})` : ''}` : '',
        color: '#F14C4C',
        notes: ex.seat ? `Seat/Row: ${ex.seat}` : '',
        isExam: true,
      };
    }).filter(Boolean);
  }, [allExams]);

  const assignmentScheduleEntries = useMemo(() => {
    return visibleAssignments
      .filter((a) => a.status !== 'done' && a.status !== 'read' && a.dueDate)
      .map((a) => {
        let dateVal;
        let startTime;
        let endTime;
        if (typeof a.dueDate === 'string' && a.dueDate.includes('T')) {
          const dObj = parseLocalDateInput(a.dueDate);
          if (!dObj) return null;
          dateVal = toLocalDateStr(dObj);
          const endMins = Math.max(60, dObj.getHours() * 60 + dObj.getMinutes());
          const startMins = Math.max(0, endMins - 90);
          startTime = `${String(Math.floor(startMins / 60)).padStart(2, '0')}:${String(startMins % 60).padStart(2, '0')}`;
          endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
        } else {
          dateVal = a.dueDate;
          startTime = '08:00';
          endTime = '09:30';
        }
        if (!dateVal) return null;
        const [ay, am, ad] = dateVal.split('-').map(Number);
        const d = new Date(ay, am - 1, ad);
        return {
          id: `assignment-${a.id}`,
          rawAssignmentId: a.id,
          title: a.title,
          courseCode: a.course || '',
          day: JS_DAY_MAP[d.getDay()],
          date: dateVal,
          startTime,
          endTime,
          room: '',
          color: a.courseColor || '#C586C0',
          notes: a.description || '',
          isAssignment: true,
        };
      }).filter(Boolean);
  }, [visibleAssignments]);

  const resolvedSchedule = useMemo(() => {
    return schedule.map((entry) => {
      if (entry.date || entry.isExam || entry.isAssignment) return entry;
      const effectiveEnd = resolveCourseEndDate(entry, allExams);
      const pauseRanges = resolveEntryPauseRanges(entry, allExams);
      return {
        ...entry,
        _effectiveEndDate: effectiveEnd,
        _endDateResolved: true,
        _pauseRanges: pauseRanges,
        _pauseRangesResolved: true,
      };
    });
  }, [schedule, allExams]);

  const combinedSchedule = useMemo(() => {
    return [
      ...resolvedSchedule,
      ...(showExamsLayer ? examScheduleEntries : []),
      ...(showAssignmentsLayer ? assignmentScheduleEntries : []),
    ];
  }, [resolvedSchedule, examScheduleEntries, assignmentScheduleEntries, showExamsLayer, showAssignmentsLayer]);

  const weekDates = useMemo(() => getWeekDates(weekOffset, lang), [weekOffset, lang]);
  const monthHeader = useMemo(() => getMonthHeaderLabel(weekDates, lang), [weekDates, lang]);
  const weekRangeStr = weekDates?.mon && weekDates?.sun ? `${weekDates.mon.formatted} – ${weekDates.sun.formatted}` : '';

  // Track recurring classes paused for Midterm week or closed after their Final-exam endDate
  const weekStatusInfo = useMemo(() => {
    let totalRecurring = 0;
    let pausedCount = 0;
    let endedCount = 0;
    resolvedSchedule.forEach((entry) => {
      if (entry.date || entry.isExam || entry.isAssignment) return;
      const dStr = weekDates[entry.day]?.dateStr;
      if (!dStr) return;
      if (entry.deletedAt && dStr >= entry.deletedAt) return;
      totalRecurring++;
      if (entry._effectiveEndDate && dStr > entry._effectiveEndDate) {
        endedCount++;
      } else if (isEntryPausedOnDate(entry, dStr)) {
        pausedCount++;
      }
    });
    return { totalRecurring, pausedCount, endedCount };
  }, [resolvedSchedule, weekDates]);

  // Dynamic compact hour window: defaults to 08:00–18:00 so blocks are wide & super readable!
  const { startHour, endHour } = useMemo(() => {
    let minH = 8;
    let maxH = 18;
    combinedSchedule.forEach((e) => {
      if (e.isAssignment) return;
      const s = Math.floor(timeToMinutes(e.startTime) / 60);
      const en = Math.ceil(timeToMinutes(e.endTime) / 60);
      if (s > 0 && s < minH) minH = Math.max(6, s);
      if (en > maxH) maxH = Math.min(23, en);
    });
    return { startHour: minH, endHour: maxH };
  }, [combinedSchedule]);

  // Show Mon–Fri cleanly unless Sat/Sun has entries or user toggles 7 days
  const hasWeekendItems = useMemo(() => {
    return combinedSchedule.some((e) => {
      if (e.day !== 'sat' && e.day !== 'sun') return false;
      const dStr = weekDates[e.day]?.dateStr;
      if (!dStr) return false;
      return isScheduleEntryActiveOnDate(e, dStr);
    });
  }, [combinedSchedule, weekDates]);

  const visibleDays = (showWeekendOverride || hasWeekendItems) ? DAYS : WEEKDAYS;

  // Today summary strip
  const todayClasses = useMemo(() => {
    const today = new Date();
    const tKey = JS_DAY_MAP[today.getDay()];
    const tStr = toLocalDateStr(today);
    const activeEx = [];
    const activeReg = [];
    combinedSchedule.forEach((e) => {
      if (e.isAssignment) return;
      if (!isScheduleEntryActiveOnDate(e, tStr)) return;
      if (e.isExam) {
        activeEx.push(e);
      } else if (e.day === tKey) {
        activeReg.push(e);
      }
    });
    return [...filterOutExamConflicts(activeReg, activeEx), ...activeEx]
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [combinedSchedule]);

  const nextTodayClass = useMemo(() => {
    return todayClasses.find((c) => timeToMinutes(c.endTime) > currentMinutes) || null;
  }, [todayClasses, currentMinutes]);

  const handleSyncCalendarNow = async () => {
    const activeToken = getToken() || accessToken;
    const email = (profile?.email || '').toLowerCase().trim();
    if (!activeToken || !email) {
      toast?.addToast?.(
        isTh ? 'กรุณาเชื่อมต่อบัญชี Google ก่อนซิงค์ปฏิทิน' : 'Please connect Google account first.',
        'warning'
      );
      return;
    }
    try {
      await calendarSyncManager.runSync(activeToken, email);
      toast?.addToast?.(
        isTh ? 'ซิงค์ตารางเรียนและวันสอบเข้า Google Calendar แล้ว' : 'Synced to Google Calendar!',
        'success'
      );
    } catch (err) {
      const msg = err?.message || '';
      const isPermErr = err?.code === 403 || msg.includes('403') || msg.toLowerCase().includes('insufficient');
      toast?.addToast?.(
        isPermErr
          ? (isTh
              ? 'ไม่มีสิทธิ์ Google Calendar (403): กรุณาออกจากระบบแล้วล็อกอิน Google ใหม่'
              : 'Calendar permission missing (403): Please log out and sign in again.')
          : (isTh ? `ซิงค์ปฏิทินไม่สำเร็จ: ${msg || 'เกิดข้อผิดพลาด'}` : `Calendar sync failed: ${msg || 'Error'}`),
        'error'
      );
    }
  };

  const openAddModal = useCallback((day, startTime, endTime, dateVal = '') => {
    setEditingEntry(null);
    setPrefillData({ day, startTime, endTime, date: dateVal });
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

  const modalEntry = editingEntry || (prefillData ? {
    title: '', courseCode: '', courseId: '',
    day: prefillData.day, date: prefillData.date,
    startTime: prefillData.startTime, endTime: prefillData.endTime,
    room: '', color: PRESET_COLORS[0], notes: '',
  } : null);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t('schedule', lang)}
        description={t('scheduleDesc', lang)}
        icon={CalendarDays}
        actions={
          <>
            <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewType('weekly')}
                aria-label={t('weeklyView', lang)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  viewType === 'weekly' ? 'bg-[var(--primary-active)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {isTh ? 'สัปดาห์' : 'Week'}
              </button>
              <button
                type="button"
                onClick={() => setViewType('daily')}
                aria-label={t('dailyView', lang)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  viewType === 'daily' ? 'bg-[var(--primary-active)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {isTh ? 'รายวัน' : 'Day'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsRegImportOpen(true)}
              className="inline-flex items-center gap-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-medium px-3 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <Upload size={13} className="text-[var(--primary-bright)]" />
              <span>{t('importReg', lang)}</span>
            </button>

            <button
              type="button"
              onClick={openBlankAdd}
              className="inline-flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-medium px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>{t('addSchedule', lang)}</span>
            </button>

            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                aria-label={isTh ? 'ตัวเลือกเพิ่มเติม' : 'More options'}
                className="p-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors cursor-pointer"
              >
                <MoreHorizontal size={16} />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute right-0 top-full mt-2 z-40 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1.5 shadow-2xl space-y-0.5 text-xs">
                  {extensionStatus?.connected && (
                    <button
                      type="button"
                      onClick={() => {
                        requestExtensionSync?.();
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-emerald-300 hover:bg-[var(--surface-hover)] cursor-pointer text-left"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span>{isTh ? 'ซิงค์จาก Extension เดี๋ยวนี้' : 'Sync from Extension'}</span>
                    </button>
                  )}

                  {profile?.email && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSyncCalendarNow();
                        setIsMoreMenuOpen(false);
                      }}
                      disabled={calSyncState === 'syncing'}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer text-left disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={`text-[var(--primary-bright)] shrink-0 ${calSyncState === 'syncing' ? 'animate-spin' : ''}`} />
                      <span>
                        {calSyncState === 'syncing'
                          ? (isTh ? 'กำลังซิงค์ปฏิทิน...' : 'Syncing Calendar...')
                          : (isTh ? 'ซิงค์ขึ้น Google Calendar' : 'Sync Google Calendar')}
                      </span>
                    </button>
                  )}

                  {viewType === 'weekly' && !hasWeekendItems && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowWeekendOverride((prev) => !prev);
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer text-left"
                    >
                      <CalendarDays size={13} className="text-[var(--text-muted)] shrink-0" />
                      <span>
                        {showWeekendOverride
                          ? (isTh ? 'แสดงเฉพาะ จ.–ศ.' : 'Show Mon–Fri only')
                          : (isTh ? 'แสดง เสาร์–อาทิตย์ ด้วย' : 'Show Sat–Sun')}
                      </span>
                    </button>
                  )}

                  {schedule.length > 0 && (
                    <div className="pt-1 mt-1 border-t border-[var(--border)]">
                      {showClearConfirm ? (
                        <div className="flex items-center gap-1 px-2 py-1">
                          <button
                            type="button"
                            onClick={() => {
                              handleClearSchedule();
                              setShowClearConfirm(false);
                              setIsMoreMenuOpen(false);
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-rose-600 text-white font-medium cursor-pointer"
                          >
                            {t('confirmBtn', lang)}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowClearConfirm(false)}
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--app-bg)] text-[var(--text-primary)] cursor-pointer"
                          >
                            {t('cancelBtn', lang)}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(true)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer text-left"
                        >
                          <Trash2 size={13} className="shrink-0" />
                          <span>{t('clearAllSchedule', lang)}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        }
      />

      {/* Contextual Date & Week Navigation Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="relative flex items-center gap-3 flex-wrap" ref={miniCalRef}>
          <button
            type="button"
            onClick={() => setIsMiniCalOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 text-left group cursor-pointer px-2.5 py-1.5 rounded-xl bg-[var(--app-bg)] border border-[var(--border)] hover:border-[var(--primary)]/60 transition-colors"
            title={isTh ? 'เลือกวันที่จากปฏิทิน' : 'Pick date from calendar'}
          >
            <CalendarIcon size={14} className="text-[var(--primary-bright)] shrink-0" />
            <span className="text-sm font-semibold text-[var(--text-heading)] group-hover:text-[var(--primary-bright)] transition-colors">
              {monthHeader || t('scheduleTitle', lang)}
            </span>
          </button>

          <span className="text-xs text-[var(--text-secondary)] font-medium">
            {weekRangeStr}
          </span>

          {isMiniCalOpen && (
            <MiniCalendarPopover
              schedule={combinedSchedule}
              lang={lang}
              weekOffset={weekOffset}
              setWeekOffset={setWeekOffset}
              weekDates={weekDates}
              onClose={() => setIsMiniCalOpen(false)}
            />
          )}
        </div>

        <div className="flex items-center bg-[var(--app-bg)] border border-[var(--border)] rounded-xl p-0.5">
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            aria-label={t('prevWeek', lang)}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              weekOffset === 0 ? 'text-[var(--primary-bright)] font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            }`}
          >
            {isTh ? 'วันนี้' : 'Today'}
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            aria-label={t('nextWeek', lang)}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ── CALM SUMMARY STRIP + LAYER TOGGLES ─────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#252526] border border-[#3C3C3C] rounded-2xl px-3.5 py-3 sm:px-4 text-xs">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <Clock size={14} className="text-[#3794FF] shrink-0 mt-0.5 sm:mt-0" />
          {todayClasses.length > 0 ? (
            <div className="line-clamp-2 sm:line-clamp-none sm:truncate text-[#D4D4D4]">
              <span className="font-semibold text-[#FFFFFF]">
                {isTh ? `วันนี้ ${todayClasses.length} คาบ` : `Today: ${todayClasses.length} classes`}
              </span>
              {nextTodayClass && (
                <span className="text-[#9D9D9D]">
                  {' · '}
                  {isTh ? 'ถัดไป' : 'Next'}{' '}
                  <span className="font-mono text-[#3794FF]">{nextTodayClass.startTime}</span>{' '}
                  <span className="text-[#FFFFFF]">{nextTodayClass.title}</span>
                  {nextTodayClass.room ? ` (${nextTodayClass.room})` : ''}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[#9D9D9D]">
              {schedule.length === 0
                ? (isTh ? 'ยังไม่มีตารางเรียน — กด "นำเข้า Reg" หรือคลิกช่องว่างบนตารางเพื่อเพิ่ม' : 'No classes yet — click "Import Reg" or any slot to add')
                : (isTh ? 'วันนี้ไม่มีคาบเรียน' : 'No classes scheduled today')}
            </span>
          )}
        </div>

        {/* Quiet Layer Toggles */}
        <div className="flex items-center gap-2 shrink-0 text-[11px]">
          <button
            type="button"
            onClick={() => setShowExamsLayer((p) => !p)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
              showExamsLayer
                ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                : 'bg-[#1E1E1E] border-[#3C3C3C] text-[#858585]'
            }`}
          >
            <ClipboardCheck size={11} />
            <span>{isTh ? 'วันสอบ' : 'Exams'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAssignmentsLayer((p) => !p)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
              showAssignmentsLayer
                ? 'bg-purple-500/15 border-purple-500/35 text-purple-300'
                : 'bg-[#1E1E1E] border-[#3C3C3C] text-[#858585]'
            }`}
          >
            <BookOpen size={11} />
            <span>{isTh ? 'งานส่ง' : 'Tasks'}</span>
          </button>
        </div>
      </div>

      {/* Subtle note when courses are paused (Midterm week) or closed (1 week before Finals) */}
      {weekStatusInfo.pausedCount > 0 && (
        <div className="flex items-center gap-2 text-[11.5px] text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3.5 py-2">
          <CalendarDays size={14} className="text-amber-300 shrink-0" />
          <span>
            {weekStatusInfo.pausedCount === weekStatusInfo.totalRecurring
              ? (isTh
                  ? 'งดเรียนช่วงสอบกลางภาคทุกวิชาในสัปดาห์นี้ — หลังสอบกลางภาคจะกลับมาเรียนปกติ'
                  : 'All recurring classes are paused for Midterm week — resuming normally afterward')
              : (isTh
                  ? `งดเรียนช่วงสอบกลางภาค ${weekStatusInfo.pausedCount} คาบในสัปดาห์นี้ — หลังสอบจะกลับมาเรียนปกติ`
                  : `${weekStatusInfo.pausedCount} recurring slots paused for Midterm week — resuming normally afterward`)}
          </span>
        </div>
      )}

      {weekStatusInfo.endedCount > 0 && (
        <div className="flex items-center gap-2 text-[11.5px] text-[#9D9D9D] bg-[#252526]/70 border border-[#3C3C3C] rounded-xl px-3.5 py-2">
          <CalendarX2 size={14} className="text-[#858585] shrink-0" />
          <span>
            {weekStatusInfo.endedCount === weekStatusInfo.totalRecurring
              ? (isTh
                  ? 'วิชาเรียนประจำปิดคอร์สครบแล้วในสัปดาห์นี้ (หยุดเรียนก่อนสอบปลายภาค 1 สัปดาห์)'
                  : 'All recurring courses have ended for this week (closed 1 week before finals)')
              : (isTh
                  ? `ปิดคอร์สแล้ว ${weekStatusInfo.endedCount} คาบในสัปดาห์นี้ (หยุดเรียนก่อนสอบ 1 สัปดาห์)`
                  : `${weekStatusInfo.endedCount} recurring slots ended this week (closed 1 week before exam)`)}
          </span>
        </div>
      )}

      {/* ── FULL-WIDTH TIMETABLE / DAILY VIEW ──────────────────────── */}
      {viewType === 'weekly' ? (
        <WeeklyGrid
          schedule={combinedSchedule}
          lang={lang}
          todayKey={todayKey}
          currentMinutes={currentMinutes}
          weekDates={weekDates}
          weekOffset={weekOffset}
          visibleDays={visibleDays}
          startHour={startHour}
          endHour={endHour}
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
          onClickAdd={openAddModal}
        />
      )}

      {/* Subtle footer hint */}
      <p className="text-[11px] text-[#858585] px-1">
        {isTh
          ? 'คลิกที่ช่องว่างเพื่อเพิ่มคาบเรียน · คลิกวิชาเรียนเพื่อแก้ไขหรือดูวันปิดคอร์ส · งดเรียนช่วงสอบกลางภาคอัตโนมัติ และปิดคอร์สก่อนสอบปลายภาค 1 สัปดาห์'
          : 'Click an empty slot to add · Click any class to edit · Auto-pauses during Midterm week and closes 1 week before Finals'}
      </p>

      {/* Add / Edit Class Modal */}
      {isModalOpen && (
        <ScheduleModal
          key={editingEntry?.id || 'new'}
          isOpen={isModalOpen}
          entry={editingEntry || modalEntry}
          visibleCourses={visibleCourses}
          schedule={resolvedSchedule}
          allExams={allExams}
          lang={lang}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEntry(null);
            setPrefillData(null);
          }}
        />
      )}

      {/* KMUTNB Reg Importer Modal */}
      {isRegImportOpen && (
        <RegImportModal
          isOpen={isRegImportOpen}
          defaultFocus="schedule"
          lang={lang}
          onClose={() => setIsRegImportOpen(false)}
          onImported={(parsed) => {
            const parts = [];
            if (parsed.meta.totalScheduleSlots > 0) {
              parts.push(isTh ? `ตารางเรียน ${parsed.meta.totalScheduleSlots} คาบ` : `${parsed.meta.totalScheduleSlots} classes`);
            }
            if (parsed.meta.totalExams > 0) {
              parts.push(isTh ? `วันสอบ ${parsed.meta.totalExams} รายการ` : `${parsed.meta.totalExams} exams`);
            }
            toast?.addToast?.(
              isTh ? `นำเข้าสำเร็จ: ${parts.join(', ')}` : `Imported: ${parts.join(', ')}`,
              'success'
            );
          }}
        />
      )}
    </div>
  );
}
