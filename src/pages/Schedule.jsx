import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CalendarDays, CalendarX2, Plus, X, Trash2, AlertTriangle, LayoutGrid, List, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '../utils/i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useAuth } from '../contexts/AuthContext';
import { examRepository } from '../repositories/examRepository';
import { parseExamDate } from '../utils/examDate';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_KEYS = {
  mon: 'dayMon', tue: 'dayTue', wed: 'dayWed', thu: 'dayThu',
  fri: 'dayFri', sat: 'daySat', sun: 'daySun',
};
const DAY_SHORT_KEYS = {
  mon: 'dayMonShort', tue: 'dayTueShort', wed: 'dayWedShort', thu: 'dayThuShort',
  fri: 'dayFriShort', sat: 'daySatShort', sun: 'daySunShort',
};
const PRESET_COLORS = [
  '#4597ff', '#34d399', '#f472b6', '#fbbf24', '#a78bfa',
  '#fb923c', '#38bdf8', '#f87171', '#4ade80', '#c084fc',
];
const START_HOUR = 6;
const END_HOUR = 24;
const JS_DAY_MAP = [null, 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const TRADITIONAL_DAY_COLORS = {
  mon: '#fbbf24', // Yellow
  tue: '#f472b6', // Pink
  wed: '#34d399', // Green
  thu: '#fb923c', // Orange
  fri: '#38bdf8', // Blue
  sat: '#a78bfa', // Purple
  sun: '#f87171'  // Red
};

const COLOR_MAP = {
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  purple: '#a855f7',
  zinc: '#71717a',
  gray: '#6b7280',
  red: '#ef4444',
  green: '#22c55e',
  orange: '#f97316'
};

function resolveHexColor(colorStr) {
  if (!colorStr) return '#71717a';
  if (colorStr.startsWith('#')) return colorStr;
  return COLOR_MAP[colorStr.toLowerCase()] || colorStr;
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
  const d = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return d === 0 ? 'sun' : JS_DAY_MAP[d];
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
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
    if (e.day !== entry.day) return false;
    
    // If one is a one-off and the other is a one-off, check if dates match
    if (e.date && entry.date && e.date !== entry.date) return false;
    
    const eStart = timeToMinutes(e.startTime);
    const eEnd = timeToMinutes(e.endTime);
    return start < eEnd && end > eStart;
  });
}

// Helper to calculate current week offset dates
function getWeekDates(offset, lang) {
  const today = new Date();
  today.setDate(today.getDate() + (offset * 7));
  const currentDay = today.getDay(); // 0=Sun, 1=Mon...
  const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayDiff);
  
  const map = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
    map[DAYS[i]] = {
      dateStr,
      formatted: d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' }),
      dayName: d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { weekday: 'long' })
    };
  }
  return map;
}

// Helper for horizontal time scale mapping
function timeToPercent(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const minutes = h * 60 + m;
  const startMinutes = START_HOUR * 60;
  const totalMinutes = (END_HOUR - START_HOUR) * 60;
  return Math.min(Math.max(((minutes - startMinutes) / totalMinutes) * 100, 0), 100);
}

// ─── WEEKLY GRID VIEW ──────────────────────────────────────────────
function WeeklyGrid({ schedule, lang, todayKey, currentMinutes, weekDates, weekOffset, onClickBlock, onClickEmpty }) {
  const gridRef = useRef(null);
  
  const timeLabels = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    timeLabels.push(`${String(h).padStart(2, '0')}:00`);
  }

  // Filter schedule based on current week offset dates
  const entriesByDay = useMemo(() => {
    const map = {};
    DAYS.forEach(d => { map[d] = []; });
    
    // Separate exams and regular classes for the current week context
    const activeExams = [];
    const activeRegular = [];

    schedule.forEach(entry => {
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

    // Filter out regular classes if they match the exam subject OR overlap in time
    const filteredRegular = activeRegular.filter(regEntry => {
      const hasConflict = activeExams.some(exam => {
        if (exam.day !== regEntry.day) return false;
        
        // 1. Match by code or title
        const codeMatch = regEntry.courseCode && exam.courseCode && 
          regEntry.courseCode.toLowerCase().trim() === exam.courseCode.toLowerCase().trim();
          
        const titleMatch = regEntry.title && exam.title && 
          regEntry.title.toLowerCase().trim() === exam.title.toLowerCase().trim();
          
        if (codeMatch || titleMatch) return true;

        // 2. Match by time overlap
        const startReg = timeToMinutes(regEntry.startTime);
        const endReg = timeToMinutes(regEntry.endTime);
        const startExam = timeToMinutes(exam.startTime);
        const endExam = timeToMinutes(exam.endTime);

        return startReg < endExam && endReg > startExam;
      });
      return !hasConflict;
    });

    // Populate the day grid map
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
    
    // Round to nearest 30 mins
    const roundedMinutes = Math.round(minutes / 30) * 30;
    const hour = Math.floor(roundedMinutes / 60);
    const minute = roundedMinutes % 60;
    const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const endHour = Math.min(hour + 1, END_HOUR);
    const endTime = `${String(endHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    
    const specificDate = weekDates[day].dateStr;
    onClickEmpty(day, startTime, endTime, specificDate);
  }, [onClickEmpty, weekDates]);

  // Current time position percent (only show if viewing current week offset = 0)
  const currentTimePercent = (currentMinutes !== null && weekOffset === 0)
    ? timeToPercent(`${Math.floor(currentMinutes / 60)}:${currentMinutes % 60}`)
    : null;
  const showTimeLine = currentTimePercent !== null && currentTimePercent >= 0 && currentTimePercent <= 100;

  return (
    <div className="bg-dark-card/20 border border-dark-border/40 rounded-2xl overflow-hidden animate-fade-in shadow-xl">
      <div className="overflow-x-auto" ref={gridRef}>
        <div className="min-w-[1250px] relative">
          
          {/* Time headers row */}
          <div className="grid grid-cols-[120px_repeat(18,1fr)] border-b border-dark-border/60 bg-dark-sidebar/40">
            <div className="p-3 text-center text-[10px] font-extrabold uppercase tracking-widest text-dark-muted flex items-center justify-center border-r border-dark-border/40 select-none">
              {lang === 'en' ? 'Day / Time' : 'วัน / เวลา'}
            </div>
            {timeLabels.map((label) => (
              <div
                key={label}
                className="p-3 text-center border-l border-dark-border/40 flex items-center justify-center min-w-0 select-none"
              >
                <span className="text-[10px] font-mono font-bold text-dark-muted">
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
                  className="grid grid-cols-[120px_1fr] relative border-b border-dark-border/40 min-h-[75px]"
                >
                  {/* Day label cell on left */}
                  <div className="flex items-center gap-2.5 p-3.5 border-r border-dark-border/40 select-none bg-dark-sidebar/10 shrink-0">
                    <div className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: TRADITIONAL_DAY_COLORS[day] }} />
                    <div className="flex flex-col items-start min-w-0">
                      <span className={`text-[11px] font-bold truncate leading-tight ${isToday ? 'text-brand-400 font-extrabold' : 'text-white'}`}>
                        {t(DAY_KEYS[day], lang)}
                      </span>
                      <span className={`text-[9px] font-mono leading-none mt-0.5 ${isToday ? 'text-brand-400/80' : 'text-dark-muted/60'}`}>
                        {weekDates[day].formatted}
                      </span>
                    </div>
                  </div>

                  {/* Day timetable slots area */}
                  <div
                    className={`relative cursor-pointer transition-all hover:bg-white/[0.005] flex-1 ${
                      isToday ? 'bg-brand-500/[0.02]' : ''
                    }`}
                    onClick={(e) => handleRowClick(day, e)}
                  >
                    {/* Hour grid vertical lines */}
                    <div className="absolute inset-0 grid grid-cols-[repeat(18,1fr)] pointer-events-none">
                      {Array.from({ length: 18 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="border-l border-dark-border/40 h-full"
                        />
                      ))}
                    </div>

                    {/* Schedule entry blocks */}
                    {entriesByDay[day].map(entry => {
                      const startPercent = timeToPercent(entry.startTime);
                      const endPercent = timeToPercent(entry.endTime);
                      const left = startPercent;
                      const width = Math.max(endPercent - startPercent, 1.5);

                      const isAssign = entry.isAssignment;
                      const isAllDay = isAssign && entry.startTime === '06:00' && entry.endTime === '24:00';

                      return (
                        <div
                          key={entry.id}
                          data-schedule-block
                          onClick={(e) => { e.stopPropagation(); onClickBlock(entry); }}
                          className={`absolute rounded-lg overflow-hidden cursor-pointer shadow-md transition-all group flex flex-col justify-center ${
                            isAssign 
                              ? 'hover:ring-2 hover:ring-white/40 hover:scale-[1.02] hover:z-30' 
                              : 'hover:ring-2 hover:ring-white/30 hover:scale-[1.01] z-10'
                          }`}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            top: isAllDay ? '4%' : (isAssign ? '15%' : '10%'),
                            bottom: isAllDay ? 'auto' : (isAssign ? '15%' : '10%'),
                            height: isAllDay ? '24px' : undefined,
                            backgroundColor: isAssign ? `${resolveHexColor(entry.color)}20` : `${resolveHexColor(entry.color)}35`,
                            border: isAssign ? `1px solid ${resolveHexColor(entry.color)}80` : undefined,
                            borderLeft: isAssign ? `1px solid ${resolveHexColor(entry.color)}80` : `4px solid ${resolveHexColor(entry.color)}`,
                            borderTop: isAssign ? undefined : `1px solid ${resolveHexColor(entry.color)}60`,
                            borderRight: isAssign ? undefined : `1px solid ${resolveHexColor(entry.color)}60`,
                            borderBottom: isAssign ? undefined : `1px solid ${resolveHexColor(entry.color)}60`,
                            boxShadow: isAssign 
                              ? `0 4px 12px ${resolveHexColor(entry.color)}30, inset 0 0 20px ${resolveHexColor(entry.color)}10` 
                              : `inset 0 0 12px 0 ${resolveHexColor(entry.color)}15, 0 3px 5px -1px rgba(0,0,0,0.25)`,
                            backdropFilter: isAssign ? 'blur(6px)' : undefined,
                            zIndex: isAssign ? 20 : 10,
                          }}
                        >
                          <div className={`p-1 h-full flex flex-col justify-center ${isAssign && !isAllDay ? 'items-start px-2' : (isAllDay ? 'flex-row items-center justify-start px-3' : 'text-center')} overflow-hidden relative`}>
                            {isAssign && (
                              <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent pointer-events-none" />
                            )}
                            <div className="flex items-center justify-center gap-1.5 min-w-0 z-10">
                              {isAssign && (
                                <span className="flex h-2 w-2 relative shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: resolveHexColor(entry.color) }}></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: resolveHexColor(entry.color) }}></span>
                                </span>
                              )}
                              <span className={`font-bold text-white leading-tight truncate group-hover:text-brand-300 transition-colors ${isAssign ? 'text-[11px]' : 'text-[10.5px]'}`}>
                                {entry.courseCode ? `${entry.courseCode} ${isAssign ? '' : `(${entry.title})`}` : entry.title}
                              </span>
                              {entry.date && !isAssign && (
                                <span className="text-[7.5px] px-1 py-0.25 rounded font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 select-none">
                                  {lang === 'en' ? 'Once' : 'พิเศษ'}
                                </span>
                              )}
                            </div>
                            
                            {isAssign && !isAllDay && (
                              <span className="text-[8.5px] text-white/90 font-mono font-medium mt-1 truncate z-10 bg-black/30 px-1.5 py-0.5 rounded shadow-sm border border-white/5">
                                Due: {entry.endTime}
                              </span>
                            )}
                            
                            {entry.room && !isAssign && (
                              <span className="text-[9px] text-dark-muted font-mono font-medium mt-0.5 truncate group-hover:text-dark-text/70 transition-colors">
                                {entry.room}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Current time indicator — only on today's row */}
                    {isToday && showTimeLine && (
                      <div
                        className="absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center"
                        style={{ left: `${currentTimePercent}%` }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 shadow-lg shadow-rose-500/50 ring-2 ring-white/20 animate-pulse" />
                        <div className="flex-1 w-[2px] bg-rose-500 shadow-[0_0_8px_1px_rgba(239,68,68,0.3)]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timetable key note at bottom */}
      <div className="p-3 text-[10px] text-dark-muted font-medium italic border-t border-dark-border/40 bg-dark-sidebar/10 rounded-b-2xl">
        {lang === 'en' 
          ? '* Note: Information displayed is Course Code (Sec.) Room' 
          : '* หมายเหตุ: ข้อมูลที่แสดงคือ รหัสวิชา (Sec.) ห้องเรียน'}
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
      const hasConflict = dayExams.some(exam => {
        // 1. Match by code or title
        const codeMatch = regEntry.courseCode && exam.courseCode && 
          regEntry.courseCode.toLowerCase().trim() === exam.courseCode.toLowerCase().trim();
          
        const titleMatch = regEntry.title && exam.title && 
          regEntry.title.toLowerCase().trim() === exam.title.toLowerCase().trim();
          
        if (codeMatch || titleMatch) return true;

        // 2. Match by time overlap
        const startReg = timeToMinutes(regEntry.startTime);
        const endReg = timeToMinutes(regEntry.endTime);
        const startExam = timeToMinutes(exam.startTime);
        const endExam = timeToMinutes(exam.endTime);

        return startReg < endExam && endReg > startExam;
      });
      return !hasConflict;
    });

    return [...filteredRegular, ...dayExams]
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [schedule, selectedDay, weekDates]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Day selector buttons */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {DAYS.map(day => {
          const isSelected = selectedDay === day;
          const isToday = day === todayKey;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 flex flex-col items-center min-w-[70px] cursor-pointer ${
                isSelected
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : isToday
                    ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500/20'
                    : 'bg-dark-card/30 text-dark-muted border border-dark-border/40 hover:border-dark-border/80 hover:text-white'
              }`}
            >
              <span>{t(DAY_SHORT_KEYS[day], lang)}</span>
              <span className={`text-[8.5px] font-mono mt-0.5 ${isSelected ? 'text-white/80' : 'text-dark-muted/50'}`}>
                {weekDates[day].formatted}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected day header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-400 font-heading">
          {weekDates[selectedDay].dayName}
        </span>
        <span className="text-xs text-dark-muted font-mono font-medium">({weekDates[selectedDay].formatted})</span>
      </div>

      {/* Entries list */}
      {dayEntries.length > 0 ? (
        <div className="space-y-3">
          {dayEntries.map(entry => (
            <button
              key={entry.id}
              onClick={() => onClickCard(entry)}
              className="w-full text-left bg-dark-card/20 border border-dark-border/30 rounded-xl p-4 hover:border-brand-500/30 hover:bg-dark-card/30 transition-all group flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors truncate">{entry.title}</h4>
                    {entry.courseCode && (
                      <span className="text-[10px] font-mono font-bold text-dark-muted bg-dark-bg/60 px-2 py-0.5 rounded-md shrink-0 border border-dark-border/30">
                        {entry.courseCode}
                      </span>
                    )}
                    {entry.date && (
                      <span className="text-[9px] px-1.5 py-0.25 rounded font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 select-none">
                        {lang === 'en' ? 'Special Class' : 'คาบเรียนพิเศษ'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3.5 mt-2 flex-wrap text-dark-muted">
                    <span className="text-xs font-mono font-bold flex items-center gap-1.5">
                      <Clock size={12} className="text-brand-400" />
                      {formatTimeRange(entry.startTime, entry.endTime)}
                    </span>
                    {entry.room && (
                      <span className="text-xs font-semibold bg-dark-bg/40 px-2 py-0.5 rounded-md border border-dark-border/30">
                        {entry.room}
                      </span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="text-[11px] text-dark-muted/80 mt-2 italic font-medium max-w-xl leading-relaxed">
                      {entry.notes}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-dark-muted group-hover:text-white transition-colors shrink-0 ml-4" />
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-12 text-center animate-fade-in shadow-inner">
          <CalendarX2 size={36} className="text-dark-muted/40 mx-auto mb-3" />
          <p className="text-xs font-semibold text-dark-muted">{t('noClasses', lang)}</p>
        </div>
      )}
    </div>
  );
}

// ─── ADD / EDIT MODAL ──────────────────────────────────────────────
function ScheduleModal({ isOpen, entry, visibleCourses, schedule, lang, onSave, onDelete, onClose }) {
  const isEdit = !!entry;

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

  const [classType, setClassType] = useState(entry?.date ? 'one-off' : 'recurring');
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
      const d = new Date(dateVal);
      const dayIndex = d.getDay(); // 0 = Sun
      const dayKey = dayIndex === 0 ? 'sun' : JS_DAY_MAP[dayIndex];
      update('day', dayKey);
    }
  };

  const handleTypeChange = (type) => {
    setClassType(type);
    if (type === 'recurring') {
      update('date', '');
    } else {
      // Prefill with today's date if empty
      const todayStr = new Date().toISOString().split('T')[0];
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
    
    const saved = {
      ...formData,
      // Ensure one-off type saves date, recurring doesn't
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-lg w-full relative shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5 border-b border-dark-border/40 pb-3">
          <h3 className="font-bold font-heading text-base text-white">
            {isEdit ? t('editSchedule', lang) : t('addSchedule', lang)}
          </h3>
          <button
            onClick={onClose}
            className="text-dark-muted hover:text-white p-1 rounded-lg hover:bg-dark-hover transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conflict warning */}
        {conflict && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 mb-4 animate-fade-in">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{t('timeConflict', lang)}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Class Type Selector */}
          <div>
            <label className="block text-[10px] font-semibold text-dark-muted mb-1.5 uppercase tracking-wider">
              {t('classType', lang)}
            </label>
            <div className="flex gap-2 p-0.5 bg-dark-sidebar border border-dark-border rounded-lg">
              <button
                type="button"
                onClick={() => handleTypeChange('recurring')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  classType === 'recurring' ? 'bg-dark-card text-brand-400 shadow-sm' : 'text-dark-muted hover:text-white'
                }`}
              >
                {t('recurringWeekly', lang)}
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('one-off')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  classType === 'one-off' ? 'bg-dark-card text-brand-400 shadow-sm' : 'text-dark-muted hover:text-white'
                }`}
              >
                {t('oneOff', lang)}
              </button>
            </div>
          </div>

          {/* Course selector (Google Classroom picker — lists non-hidden courses) */}
          <div>
            <label className="block text-[10px] font-semibold text-dark-muted mb-1.5 uppercase tracking-wider">
              {t('selectCourse', lang)}
            </label>
            <select
              value={isCustom ? '__custom__' : formData.courseId}
              onChange={handleCourseSelect}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none cursor-pointer"
            >
              <option value="__custom__">{t('customEntry', lang)}</option>
              {visibleCourses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Title & Code — editable when custom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-dark-muted mb-1.5 uppercase tracking-wider">
                {t('courseName', lang)}
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => update('title', e.target.value)}
                readOnly={!isCustom}
                className={`w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none ${!isCustom ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-dark-muted mb-1.5 uppercase tracking-wider">
                {t('courseCodeLabel', lang)}
              </label>
              <input
                type="text"
                value={formData.courseCode}
                onChange={(e) => update('courseCode', e.target.value)}
                readOnly={!isCustom}
                className={`w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none ${!isCustom ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>

          {/* Date Picker or Day Selector */}
          {classType === 'one-off' ? (
            <div>
              <label className="block text-[10px] font-semibold text-dark-muted mb-1.5 uppercase tracking-wider">
                {t('selectDate', lang)}
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none cursor-pointer"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-semibold text-dark-muted mb-1.5 uppercase tracking-wider">
                {t('schedule', lang)}
              </label>
              <select
                value={formData.day}
                onChange={(e) => update('day', e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none cursor-pointer"
              >
                {DAYS.map(d => (
                  <option key={d} value={d}>{t(DAY_KEYS[d], lang)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-dark-muted mb-1.5 uppercase tracking-wider">
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
                    endTime: addHoursToTime(val, 3) // Auto default +3 hours
                  }));
                }}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider leading-none">
                  {t('endTime', lang)}
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleApplyDuration(1.5)}
                    className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/25 hover:bg-brand-500/20 transition-all cursor-pointer leading-none"
                    title="+1.5 Hours"
                  >
                    +1.5h
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDuration(3)}
                    className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/25 hover:bg-brand-500/20 transition-all cursor-pointer leading-none"
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
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Room */}
          <div>
            <label className="block text-[10px] font-semibold text-dark-muted mb-1.5 uppercase tracking-wider">
              {t('roomLabel', lang)}
            </label>
            <input
              type="text"
              value={formData.room}
              onChange={(e) => update('room', e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          {/* Color picker — only show when custom entry is selected */}
          {isCustom && (
            <div>
              <label className="block text-[10px] font-semibold text-dark-muted mb-1.5 uppercase tracking-wider">
                {t('colorLabel', lang)}
              </label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update('color', c)}
                    className={`w-7 h-7 rounded-full transition-all cursor-pointer ${
                      formData.color === c
                        ? 'ring-2 ring-offset-2 ring-offset-dark-card scale-110'
                        : 'hover:scale-110'
                    }`}
                    style={{
                      backgroundColor: c,
                      ...(formData.color === c ? { ringColor: c } : {}),
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-semibold text-dark-muted mb-1.5 uppercase tracking-wider">
              {t('scheduleNotes', lang)}
            </label>
            <textarea
              rows="2"
              value={formData.notes}
              onChange={(e) => update('notes', e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-dark-border/40 mt-3">
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    showDeleteConfirm
                      ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg'
                      : 'text-dark-muted hover:text-rose-400'
                  }`}
                >
                  <Trash2 size={13} />
                  {showDeleteConfirm ? t('deleteExamBtn', lang) : t('deleteSchedule', lang)}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-bold text-dark-muted hover:text-white hover:bg-dark-hover transition-colors cursor-pointer"
              >
                {t('cancelBtn', lang)}
              </button>
              <button
                type="submit"
                className="bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-md shadow-brand-500/10"
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
  const { schedule, assignments, visibleCourses, handleSaveScheduleEntry, handleDeleteScheduleEntry, handleClearSchedule } = useClassroom();

  const [viewType, setViewType] = useState('weekly');
  const [selectedDay, setSelectedDay] = useState(getTodayKey());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, 1 = next week, -1 = previous week
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const todayKey = getTodayKey();
  const activeEmail = (profile?.email || '').toLowerCase().trim();

  // Load cached exams and map to schedule entries
  const examScheduleEntries = useMemo(() => {
    if (!activeEmail) return [];
    const cachedResult = examRepository.getCachedExams(activeEmail);
    if (!cachedResult.success || !cachedResult.data) return [];
    
    const examList = cachedResult.data.exams || [];
    const manualExamList = cachedResult.data.manualExams || [];
    const allExams = [...examList, ...manualExamList];

    return allExams.map(ex => {
      // Find time range (default 09:00 - 12:00 if not parsed)
      let startTime = '09:00';
      let endTime = '12:00';
      if (ex.time) {
        const parts = ex.time.split('-').map(s => s.trim());
        if (parts.length === 2) {
          startTime = parts[0];
          endTime = parts[1];
        }
      }

      // Find YYYY-MM-DD date string
      let dateVal = '';
      if (ex.rawIsoDate) {
        dateVal = ex.rawIsoDate.split('T')[0];
      } else if (ex.date) {
        const parsed = parseExamDate(ex.date);
        if (parsed) {
          dateVal = parsed.toISOString().split('T')[0];
        }
      }

      if (!dateVal) return null;

      const d = new Date(dateVal);
      const dayIndex = d.getDay();
      const dayKey = dayIndex === 0 ? 'sun' : JS_DAY_MAP[dayIndex];

      return {
        id: `exam-${ex.id}`,
        title: ex.subjectName || ex.courseName || 'Exam',
        courseCode: ex.subjectCode || ex.courseCode || '',
        day: dayKey,
        date: dateVal,
        startTime,
        endTime,
        room: ex.room ? `${ex.room} ${ex.seat ? `(${ex.seat})` : ''}` : '',
        color: '#ef4444', // Red color for exams
        notes: ex.seat ? `Seat/Row: ${ex.seat}` : '',
        isExam: true
      };
    }).filter(Boolean);
  }, [activeEmail]);

  // Load assignments and map to schedule entries
  const assignmentScheduleEntries = useMemo(() => {
    if (!assignments) return [];
    return assignments.map(a => {
      if (!a.dueDate) return null;
      let dateVal = '';
      let startTime = '23:00';
      let endTime = '23:59';
      
      const hasTime = a.dueDate.includes('T');
      if (hasTime) {
        const [d, t] = a.dueDate.split('T');
        dateVal = d;
        const timePart = t.split('.')[0].substring(0, 5); // get HH:mm
        endTime = timePart;
        
        // Give it a 2-hour width ending at the deadline for better visibility
        const [h, m] = timePart.split(':').map(Number);
        const startH = Math.max(6, h - 2);
        startTime = `${String(startH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      } else {
        dateVal = a.dueDate;
        startTime = '06:00';
        endTime = '24:00'; // All-day span
      }
      
      if (!dateVal) return null;

      const d = new Date(dateVal);
      const dayIndex = d.getDay();
      const dayKey = dayIndex === 0 ? 'sun' : JS_DAY_MAP[dayIndex];

      return {
        id: `assignment-${a.id}`,
        title: a.title.replace('📌 ', ''), // Clean up the title, we use glowing dot instead
        courseCode: a.course || '',
        day: dayKey,
        date: dateVal,
        startTime,
        endTime,
        room: '',
        color: a.courseColor || '#a855f7',
        notes: a.description || '',
        isAssignment: true
      };
    }).filter(Boolean);
  }, [assignments]);

  // Combine standard schedule, auto-loaded exams, and assignments
  const combinedSchedule = useMemo(() => {
    return [...schedule, ...examScheduleEntries, ...assignmentScheduleEntries];
  }, [schedule, examScheduleEntries, assignmentScheduleEntries]);

  // Dynamic week offset dates mapping
  const weekDates = useMemo(() => {
    return getWeekDates(weekOffset, lang);
  }, [weekOffset, lang]);

  const weekRangeStr = useMemo(() => {
    if (!weekDates || !weekDates.mon || !weekDates.sun) return '';
    return `${weekDates.mon.formatted} – ${weekDates.sun.formatted}`;
  }, [weekDates]);

  // Update current time indicator position every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const openAddModal = useCallback((day, startTime, endTime, dateVal = '') => {
    setEditingEntry(null);
    setPrefillData({ 
      day, 
      startTime, 
      endTime,
      // Only default a date if the entry type is one-off
      date: dateVal 
    });
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((entry) => {
    if (entry.isExam) {
      setWarningMessage(lang === 'th' 
        ? `วิชาสอบนี้ถูกดึงมาจากระบบค้นหาห้องสอบโดยอัตโนมัติ\nต้องการแก้ไขหรือลบ กรุณาไปที่เมนู "ตารางสอบ/ค้นหาห้องสอบ"` 
        : `This exam is automatically loaded from the Exam Seating room.\nTo edit or delete it, please go to the "Exam Seating" menu.`
      );
      return;
    }
    if (entry.isAssignment) {
      setWarningMessage(lang === 'th' 
        ? `งานนี้ถูกดึงมาจาก Google Classroom โดยอัตโนมัติ\nไม่สามารถแก้ไขหรือลบจากที่นี่ได้ครับ` 
        : `This assignment is automatically loaded from Google Classroom.\nIt cannot be edited or deleted from here.`
      );
      return;
    }
    setEditingEntry(entry);
    setPrefillData(null);
    setIsModalOpen(true);
  }, [lang]);

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
    handleDeleteScheduleEntry(id);
    setIsModalOpen(false);
    setEditingEntry(null);
  }, [handleDeleteScheduleEntry]);

  const handleClearAll = () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }
    handleClearSchedule();
    setShowClearConfirm(false);
  };

  // Build modal entry with prefill data
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

  // Auto-collapse / switch to Daily view on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewType('daily');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in py-1">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border/40 pb-5">
        <div>
          <h1 className="text-xl font-bold font-heading text-white flex items-center gap-2.5">
            <CalendarDays size={20} className="text-brand-400" />
            {t('scheduleTitle', lang)}
          </h1>
          <p className="text-[11px] text-dark-muted mt-1 leading-relaxed">{t('scheduleDesc', lang)}</p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          {/* Clear All */}
          {schedule.length > 0 && (
            <button
              onClick={handleClearAll}
              className={`text-[11px] font-bold py-2.5 px-3 rounded-lg border transition-all cursor-pointer ${
                showClearConfirm
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                  : 'text-dark-muted border-dark-border hover:border-rose-500/30 hover:text-rose-400 hover:bg-rose-500/[0.02]'
              }`}
            >
              {showClearConfirm ? t('clearAllConfirm', lang) : t('clearAllSchedule', lang)}
            </button>
          )}

          {/* View toggle — hidden on mobile since mobile only supports list view */}
          <div className="hidden md:flex items-center border border-dark-border rounded-lg p-0.5 bg-dark-sidebar">
            <button
              onClick={() => setViewType('weekly')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewType === 'weekly' ? 'bg-dark-card text-brand-400' : 'text-dark-muted hover:text-white'}`}
              title={t('weeklyView', lang)}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewType('daily')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewType === 'daily' ? 'bg-dark-card text-brand-400' : 'text-dark-muted hover:text-white'}`}
              title={t('dailyView', lang)}
            >
              <List size={15} />
            </button>
          </div>

          {/* Add button */}
          <button
            onClick={openBlankAdd}
            className="flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-md shadow-brand-500/10 active:scale-[0.98]"
          >
            <Plus size={16} />
            {t('addSchedule', lang)}
          </button>
        </div>
      </div>

      {/* Week Navigation controls */}
      <div className="flex items-center justify-between bg-dark-card/25 backdrop-blur-sm border border-dark-border/40 rounded-xl px-4 py-2 hover:border-dark-border/60 transition-colors">
        {/* Grouped Navigator Buttons (cohesive look matching view toggle) */}
        <div className="flex items-center border border-dark-border/60 rounded-lg p-0.5 bg-dark-sidebar shrink-0">
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-1.5 rounded-md text-dark-muted hover:text-white hover:bg-dark-card transition-all cursor-pointer"
            title={t('prevWeek', lang)}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className={`px-3 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
              weekOffset === 0 
                ? 'bg-dark-card text-brand-400 font-black shadow-sm' 
                : 'text-dark-muted hover:text-white'
            }`}
          >
            {t('thisWeek', lang)}
          </button>
          <button
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-1.5 rounded-md text-dark-muted hover:text-white hover:bg-dark-card transition-all cursor-pointer"
            title={t('nextWeek', lang)}
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Center: Dynamic date range representation */}
        <div className="text-xs font-bold text-white/90 font-mono tracking-wide px-3 py-1.5 bg-dark-sidebar/45 rounded-lg border border-dark-border/20 shadow-inner select-none hidden sm:block">
          {weekRangeStr}
        </div>

        {/* Right: Relative Week Indicator Label (styled pill) */}
        <div className="bg-brand-500/10 border border-brand-500/20 px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest text-brand-400 shadow-[0_0_12px_rgba(99,102,241,0.05)] select-none shrink-0">
          {weekOffset === 0 
            ? (lang === 'en' ? 'Current Week' : 'สัปดาห์ปัจจุบัน')
            : weekOffset === 1 
              ? (lang === 'en' ? 'Next Week' : 'สัปดาห์ถัดไป')
              : weekOffset === -1 
                ? (lang === 'en' ? 'Last Week' : 'สัปดาห์ที่แล้ว')
                : (lang === 'en' ? `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}` : `สัปดาห์ ${weekOffset > 0 ? '+' : ''}${weekOffset}`)
          }
        </div>
      </div>

      {/* Views */}
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

      {/* Add / Edit Modal */}
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

      {/* Warning Modal */}
      {warningMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-dark-card border border-dark-border rounded-xl w-full max-w-sm overflow-hidden p-6 space-y-4 text-center">
            <div className="flex justify-center text-amber-400">
              <AlertTriangle size={36} />
            </div>
            <h3 className="font-bold text-sm text-white">
              {lang === 'th' ? 'การแจ้งเตือนระบบ' : 'System Notification'}
            </h3>
            <p className="text-xs text-dark-muted leading-relaxed whitespace-pre-line">
              {warningMessage}
            </p>
            <button
              onClick={() => setWarningMessage('')}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs py-2 rounded-lg transition-colors cursor-pointer"
            >
              {lang === 'th' ? 'ตกลง' : 'OK'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
