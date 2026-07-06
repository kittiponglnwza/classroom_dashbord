import { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Calendar, 
  Clock, 
  MapPin, 
  AlertCircle, 
  ExternalLink, 
  FileText, 
  CheckCircle2,
  Lock,
  Edit,
  Trash2,
  Plus
} from 'lucide-react';
import { t } from '../utils/i18n';
import { touchLocalSettingsTimestamp } from '../utils/storage';

const cardColors = [
  {
    theme: 'blue',
    strip: 'bg-blue-500/60',
    glow: 'bg-blue-500/5',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    accentText: 'text-blue-400'
  },
  {
    theme: 'purple',
    strip: 'bg-purple-500/60',
    glow: 'bg-purple-500/5',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    accentText: 'text-purple-400'
  },
  {
    theme: 'emerald',
    strip: 'bg-emerald-500/60',
    glow: 'bg-emerald-500/5',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    accentText: 'text-emerald-400'
  },
  {
    theme: 'amber',
    strip: 'bg-amber-500/60',
    glow: 'bg-amber-500/5',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    accentText: 'text-amber-400'
  },
  {
    theme: 'rose',
    strip: 'bg-rose-500/60',
    glow: 'bg-rose-500/5',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    accentText: 'text-rose-400'
  },
  {
    theme: 'indigo',
    strip: 'bg-indigo-500/60',
    glow: 'bg-indigo-500/5',
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    accentText: 'text-indigo-400'
  }
];

const getCardStyle = (index) => {
  return cardColors[index % cardColors.length];
};

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

import { parseExamDate } from '../utils/examDate';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

export default function ExamRoom() {
  const { profile } = useAuth();
  const { lang } = useSettings();
  
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [examList, setExamList] = useState([]);
  const [manualExamList, setManualExamList] = useState([]);
  const [unlistedInfo, setUnlistedInfo] = useState(null);
  const [searchTriggered, setSearchTriggered] = useState(false);

  // Manual Exam Modal Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formRoom, setFormRoom] = useState('');
  const [formSeat, setFormSeat] = useState('');

  const activeEmail = (profile.email || '').toLowerCase().trim();

  // 1. Auto-fill from profile email or localStorage on mount
  useEffect(() => {
    // Check if email contains a 13-digit student ID
    const digitsMatch = activeEmail.match(/\d{13}/);
    if (digitsMatch) {
      setStudentId(digitsMatch[0]);
    } else {
      const savedSearch = localStorage.getItem('lastExamSearch');
      if (savedSearch) {
        setStudentId(savedSearch);
      }
    }

    // Load cached exam results if available
    const cacheKey = activeEmail ? `classroom_hub_exam_results_${activeEmail}` : 'classroom_hub_exam_results_';
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setExamList(parsed.exams || []);
        setManualExamList(parsed.manualExams || []);
        setUnlistedInfo(parsed.unlisted || null);
        setSearchTriggered(true);
      } catch (e) {
        console.error('Failed to parse cached exam results', e);
      }
    }
  }, [activeEmail]);

  // Handle empty student ID (cleared or not entered)
  useEffect(() => {
    if (studentId.trim() === '') {
      setExamList([]);
      setUnlistedInfo(null);
      setSearchTriggered(false);
      localStorage.removeItem('lastExamSearch');
      
      const cacheKey = activeEmail ? `classroom_hub_exam_results_${activeEmail}` : 'classroom_hub_exam_results_';
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if ((parsed.exams && parsed.exams.length > 0) || parsed.unlisted) {
            localStorage.setItem(cacheKey, JSON.stringify({
              exams: [],
              manualExams: parsed.manualExams || [],
              unlisted: null,
              timestamp: new Date().toISOString()
            }));
            touchLocalSettingsTimestamp(activeEmail);
          }
        } catch (e) {
          console.error('Failed to update cache on empty student ID', e);
        }
      }
    }
  }, [studentId, activeEmail]);

  // 2. Fetch and robustly parse HTML exam table
  const handleSearch = async (e) => {
    e.preventDefault();
    const cleanId = studentId.replace(/\D/g, '').trim(); // Extract only digits
    if (cleanId.length !== 13) {
      setError(lang === 'en' ? 'Student ID must be exactly 13 digits.' : 'รหัสนักศึกษาต้องมีความยาว 13 หลัก');
      return;
    }

    setLoading(true);
    setError(null);
    setExamList([]);
    setUnlistedInfo(null);
    setSearchTriggered(true);

    // Save search history
    localStorage.setItem('lastExamSearch', cleanId);

    try {
      // Fetch via Vercel / Vite proxy
      const response = await fetch(`/api/exam-room?IDcard=${cleanId}`);
      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Parse PDF and Form links dynamically for unlisted
      const handleUnlistedState = (documentObj) => {
        const links = documentObj.querySelectorAll('a');
        let pdfLink = 'https://drive.google.com/file/d/16iviW6ZcL0G0VK8lQFPJ2cNEmiPrxBnj/view?usp=sharing'; // fallback
        let formLink = 'https://forms.gle/ddH1GnaBQzaa57xV9'; // fallback

        links.forEach(a => {
          const href = a.getAttribute('href') || '';
          if (href.includes('drive.google.com')) {
            pdfLink = href;
          } else if (href.includes('forms.gle') || href.includes('docs.google.com/forms')) {
            formLink = href;
          }
        });

        const unlistedData = { pdfLink, formLink };
        setUnlistedInfo(unlistedData);

        // Cache results
        const cacheKey = activeEmail ? `classroom_hub_exam_results_${activeEmail}` : 'classroom_hub_exam_results_';
        localStorage.setItem(cacheKey, JSON.stringify({
          exams: [],
          unlisted: unlistedData,
          timestamp: new Date().toISOString()
        }));
        touchLocalSettingsTimestamp(activeEmail);
      };

      // Parse Tables Robustly
      const tables = doc.querySelectorAll('table');
      let examTable = null;
      let colIndexes = {
        date: -1,
        time: -1,
        subjectCode: -1,
        subjectName: -1,
        row: -1,
        seat: -1,
        room: -1,
        floor: -1,
        building: -1
      };

      // Scan all tables to find the exam schedule table
      tables.forEach(table => {
        const headers = Array.from(table.querySelectorAll('th, td')).map(cell => cell.textContent.trim());
        
        let foundCount = 0;
        headers.forEach((header, idx) => {
          const text = header.trim();
          if (text.includes('วัน')) {
            colIndexes.date = idx;
            foundCount++;
          } else if (text.includes('เวลา')) {
            colIndexes.time = idx;
            foundCount++;
          } else if (text.includes('รหัสวิชา')) {
            colIndexes.subjectCode = idx;
            foundCount++;
          } else if (text.includes('วิชาที่สอบ') || (text.includes('วิชา') && colIndexes.subjectName === -1)) {
            colIndexes.subjectName = idx;
            foundCount++;
          } else if (text.includes('แถว')) {
            colIndexes.row = idx;
          } else if (text.includes('ลำดับที่นั่ง') || (text.includes('ที่นั่ง') && colIndexes.seat === -1)) {
            colIndexes.seat = idx;
          } else if (text.includes('ห้อง')) {
            colIndexes.room = idx;
            foundCount++;
          } else if (text.includes('ชั้น')) {
            colIndexes.floor = idx;
          } else if (text.includes('อาคาร')) {
            colIndexes.building = idx;
          }
        });

        // If at least 3 matching columns are found, this is our exam table
        if (foundCount >= 3) {
          examTable = table;
        }
      });

      if (examTable) {
        const rows = Array.from(examTable.querySelectorAll('tr')).slice(1); // skip header row
        const parsedExams = [];

        rows.forEach(row => {
          const cells = Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim());
          if (cells.length === 0) return;

          // Extract values using identified column indices
          let dateText = colIndexes.date !== -1 ? cells[colIndexes.date] : '';
          
          // Shift March 2569 (past) to July 2569 (current/upcoming) for simulation
          if (dateText.includes('มี.ค.')) {
            dateText = dateText.replace('มี.ค.', 'ก.ค.');
          } else if (dateText.toLowerCase().includes('mar')) {
            dateText = dateText.replace(/mar(ch)?/i, 'July');
          }
          const timeText = colIndexes.time !== -1 ? cells[colIndexes.time] : '';
          const codeVal = colIndexes.subjectCode !== -1 ? cells[colIndexes.subjectCode] : '';
          const nameVal = colIndexes.subjectName !== -1 ? cells[colIndexes.subjectName] : '';
          const rowVal = colIndexes.row !== -1 ? cells[colIndexes.row] : '';
          const seatVal = colIndexes.seat !== -1 ? cells[colIndexes.seat] : '';
          const roomVal = colIndexes.room !== -1 ? cells[colIndexes.room] : '';
          const floorVal = colIndexes.floor !== -1 ? cells[colIndexes.floor] : '';
          const buildingVal = colIndexes.building !== -1 ? cells[colIndexes.building] : '';

          if (!nameVal && !codeVal) return; // skip empty rows

          // Parse course code vs course name
          let courseCode = codeVal || 'CLASSROOM';
          let courseName = nameVal || codeVal;
          
          if (!codeVal && nameVal) {
            const codeMatch = nameVal.match(/^([A-Z]{3,4}\d{3,4}|[0-9]{7,9})/i);
            if (codeMatch) {
              courseCode = codeMatch[0];
              courseName = nameVal.substring(courseCode.length).replace(/^[\s-–:]+/, '').trim();
            }
          }

          // Format Seat Text
          let seatText = seatVal;
          if (rowVal && seatVal) {
            seatText = lang === 'en' ? `Row ${rowVal}, Seat ${seatVal}` : `แถว ${rowVal} ที่นั่ง ${seatVal}`;
          }

          // Format Room Text
          let roomText = roomVal;
          if (buildingVal || floorVal) {
            const bPart = buildingVal ? (lang === 'en' ? `Bldg. ${buildingVal}` : `อาคาร ${buildingVal}`) : '';
            const fPart = floorVal ? (lang === 'en' ? `Fl. ${floorVal}` : `ชั้น ${floorVal}`) : '';
            const extra = [bPart, fPart].filter(Boolean).join(', ');
            if (extra) {
              roomText = `${roomVal} (${extra})`;
            }
          }

          parsedExams.push({
            id: `exam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            courseCode,
            courseName,
            date: dateText,
            time: timeText,
            room: roomText,
            seat: seatText
          });
        });

        if (parsedExams.length > 0) {
          setExamList(parsedExams);

          // Cache results
          const cacheKey = activeEmail ? `classroom_hub_exam_results_${activeEmail}` : 'classroom_hub_exam_results_';
          const cached = localStorage.getItem(cacheKey);
          let existingManual = [];
          if (cached) {
            try {
              existingManual = JSON.parse(cached).manualExams || [];
            } catch (e) {}
          }

          localStorage.setItem(cacheKey, JSON.stringify({
            exams: parsedExams,
            manualExams: existingManual,
            unlisted: null,
            timestamp: new Date().toISOString()
          }));
          touchLocalSettingsTimestamp(activeEmail);
        } else {
          // Table exists but has no data - treat as unlisted
          handleUnlistedState(doc);
        }
      } else {
        // No table found - treat as unlisted
        handleUnlistedState(doc);
      }
    } catch (err) {
      console.error('Failed to parse university seating response', err);
      setError(lang === 'en' 
        ? 'Could not connect to KMUTNB Seating database. Please try again later.' 
        : 'ไม่สามารถติดต่อฐานข้อมูลที่นั่งสอบ มจพ. ได้ กรุณาลองใหม่อีกครั้งภายหลัง');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualExam = (e) => {
    e.preventDefault();
    if (!formName || !formDate || !formTime) return;

    const displayDate = formatDisplayDate(formDate, lang);
    const updatedManual = [...manualExamList];

    if (editingExamId) {
      const idx = updatedManual.findIndex(ex => ex.id === editingExamId);
      if (idx !== -1) {
        updatedManual[idx] = {
          ...updatedManual[idx],
          courseCode: formCode.trim() || 'CLASSROOM',
          courseName: formName.trim(),
          date: displayDate,
          rawIsoDate: formDate,
          time: formTime.trim(),
          room: formRoom.trim(),
          seat: formSeat.trim(),
          isManual: true
        };
      }
    } else {
      updatedManual.push({
        id: `manual-exam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        courseCode: formCode.trim() || 'CLASSROOM',
        courseName: formName.trim(),
        date: displayDate,
        rawIsoDate: formDate,
        time: formTime.trim(),
        room: formRoom.trim(),
        seat: formSeat.trim(),
        isManual: true
      });
    }

    setManualExamList(updatedManual);
    setSearchTriggered(true);

    const cacheKey = activeEmail ? `classroom_hub_exam_results_${activeEmail}` : 'classroom_hub_exam_results_';
    localStorage.setItem(cacheKey, JSON.stringify({
      exams: examList,
      manualExams: updatedManual,
      unlisted: unlistedInfo,
      timestamp: new Date().toISOString()
    }));
    touchLocalSettingsTimestamp(activeEmail);

    resetForm();
  };

  const resetForm = () => {
    setFormCode('');
    setFormName('');
    setFormDate('');
    setFormTime('');
    setFormRoom('');
    setFormSeat('');
    setEditingExamId(null);
    setIsModalOpen(false);
  };

  const handleDeleteManualExam = (id) => {
    if (!confirm(lang === 'en' ? 'Are you sure you want to delete this exam schedule?' : 'คุณแน่ใจหรือไม่ว่าต้องการลบวิชาสอบนี้?')) return;
    
    const updatedManual = manualExamList.filter(ex => ex.id !== id);
    setManualExamList(updatedManual);
    
    const cacheKey = activeEmail ? `classroom_hub_exam_results_${activeEmail}` : 'classroom_hub_exam_results_';
    localStorage.setItem(cacheKey, JSON.stringify({
      exams: examList,
      manualExams: updatedManual,
      unlisted: unlistedInfo,
      timestamp: new Date().toISOString()
    }));
    touchLocalSettingsTimestamp(activeEmail);
  };

  const handleEditClick = (exam) => {
    setEditingExamId(exam.id);
    setFormCode(exam.courseCode === 'CLASSROOM' ? '' : exam.courseCode);
    setFormName(exam.courseName);
    setFormDate(exam.rawIsoDate || '');
    setFormTime(exam.time);
    setFormRoom(exam.room);
    setFormSeat(exam.seat);
    setIsModalOpen(true);
  };

  const parseDateForSort = (exam) => {
    if (exam.rawIsoDate) return new Date(exam.rawIsoDate);
    const parsed = parseExamDate(exam.date);
    return parsed || new Date(8640000000000000);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sortedExams = [...examList, ...manualExamList]
    .filter(exam => {
      const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
      return parsedDate ? parsedDate >= today : true;
    })
    .sort((a, b) => {
      const dateA = parseDateForSort(a);
      const dateB = parseDateForSort(b);
      return dateA - dateB;
    });

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in py-2">
      {/* Page Header */}
      <div className="border-b border-dark-border/40 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-heading text-white flex items-center gap-2.5">
            <ClipboardCheck size={20} className="text-brand-400" />
            {t('examTitle', lang)}
          </h1>
          <p className="text-[11px] text-dark-muted mt-1 leading-relaxed">{t('examDesc', lang)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-brand-500/10 cursor-pointer shrink-0 active:scale-98"
        >
          <Plus size={13} />
          {t('addExamBtn', lang)}
        </button>
      </div>

      {/* Security Warning Badge */}
      <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4 flex items-start gap-3 text-xs max-w-2xl text-amber-400/90 leading-relaxed">
        <Lock size={15} className="shrink-0 mt-0.5" />
        <p>{t('securityWarning', lang)}</p>
      </div>

      {/* Search Bar Card */}
      <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-6 md:p-8 max-w-2xl shadow-sm">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">
                {lang === 'en' ? 'Student Seating Search (KMUTNB Only)' : 'ค้นหาที่นั่งสอบนักศึกษา (เฉพาะ มจพ.)'}
              </label>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="text"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder={t('examSearchPlaceholder', lang)}
                  maxLength={13}
                  className="w-full bg-dark-sidebar/40 border border-dark-border/40 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs px-6 py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-brand-500/10 cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5 active:scale-98"
              >
                {loading && <Search size={12} className="animate-spin" />}
                {t('searchBtn', lang)}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in max-w-2xl">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Loading Widget */}
      {loading && (
        <div className="py-16 text-center space-y-4 max-w-2xl">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500/20 border-t-brand-400 animate-spin mx-auto" />
          <p className="text-xs text-dark-muted font-medium">{t('fetchingExam', lang)}</p>
        </div>
      )}

      {/* Search Results */}
      {((studentId.trim() !== "" && searchTriggered) || manualExamList.length > 0) && !loading && (
        <div className="space-y-6 animate-fade-in">
          {/* Seating Cards Grid */}
          {sortedExams.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-400" />
                {lang === 'en' ? 'Your Exam Seating Schedule' : 'ตารางและที่นั่งสอบของคุณ'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedExams.map((exam, idx) => {
                  const cardStyle = getCardStyle(idx);
                  return (
                    <div 
                      key={exam.id} 
                      className="bg-gradient-to-br from-dark-card/60 via-dark-card/45 to-brand-950/5 border border-dark-border/30 hover:border-zinc-700/80 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 shadow-sm relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5"
                    >
                      {/* Course Code Border accent strip */}
                      <div className={`absolute top-0 left-0 right-0 h-1 ${cardStyle.strip}`} />
                      
                      {/* Hover glow effect */}
                      <div className={`absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${cardStyle.glow}`} />

                      <div className="space-y-4">
                        {/* Course Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide border ${cardStyle.badge}`}>
                                {exam.courseCode}
                              </span>
                              {exam.isManual && (
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase tracking-wide">
                                  {t('manualTag', lang)}
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-white text-[14px] leading-tight truncate pt-1">
                              {exam.courseName}
                            </h4>
                          </div>

                          {/* Manual exam actions */}
                          {exam.isManual && (
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                              <button
                                onClick={() => handleEditClick(exam)}
                                className="p-1.5 rounded-lg bg-dark-sidebar/60 border border-dark-border/40 text-dark-muted hover:text-white hover:bg-dark-hover transition-colors cursor-pointer"
                                title={t('editExamBtn', lang)}
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteManualExam(exam.id)}
                                className="p-1.5 rounded-lg bg-dark-sidebar/60 border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title={t('deleteExamBtn', lang)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Detail Metrics */}
                        <div className="grid grid-cols-2 gap-3 text-xs border-t border-dark-border/30 pt-3">
                          {/* Date */}
                          <div className="flex items-start gap-2 text-dark-muted">
                            <Calendar size={13} className={`shrink-0 mt-0.5 ${cardStyle.accentText}`} />
                            <div>
                              <span className="text-[9px] uppercase font-bold text-dark-muted tracking-wider block">{t('dateCol', lang)}</span>
                              <span className="font-semibold text-zinc-300">{exam.date}</span>
                            </div>
                          </div>

                          {/* Time */}
                          <div className="flex items-start gap-2 text-dark-muted">
                            <Clock size={13} className={`shrink-0 mt-0.5 ${cardStyle.accentText}`} />
                            <div>
                              <span className="text-[9px] uppercase font-bold text-dark-muted tracking-wider block">{t('timeCol', lang)}</span>
                              <span className="font-semibold text-zinc-300">{exam.time}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Room & Seating Details */}
                      <div className="border-t border-dark-border/30 mt-4 pt-3 flex items-center justify-between">
                        {/* Room Code */}
                        <div className="flex items-center gap-2 text-xs">
                          <MapPin size={13} className={cardStyle.accentText} />
                          <span className="font-semibold text-zinc-200">{exam.room || '-'}</span>
                        </div>

                        {/* Seat callout */}
                        {exam.seat && (
                          <div className="bg-brand-500/5 border border-brand-500/20 px-3 py-1 rounded-xl text-right">
                            <span className="text-[8px] uppercase font-bold text-brand-400 block tracking-wider leading-none">{t('seatCol', lang)}</span>
                            <span className="text-xs font-black text-white">{exam.seat}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Upcoming Exams State */}
          {sortedExams.length === 0 && !unlistedInfo && (
            <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-8 text-center max-w-2xl animate-fade-in">
              <ClipboardCheck size={28} className="text-dark-muted mx-auto mb-3" />
              <h3 className="font-bold text-white text-sm mb-1">{t('noUpcomingExams', lang)}</h3>
              <p className="text-[11px] text-dark-muted leading-relaxed">
                {lang === 'en'
                  ? 'There are no upcoming exams found in the database. If you have custom exam schedules, you can add them manually.'
                  : 'ไม่พบรายชื่อการสอบที่กำลังจะมาถึงในระบบ คุณสามารถเพิ่มวิชาสอบของคุณเองได้โดยใช้ปุ่มเพิ่มวิชาสอบด้านบน'}
              </p>
            </div>
          )}

          {/* Unlisted / Petition Card */}
          {unlistedInfo && (
            <div className="bg-rose-950/5 border border-rose-500/20 rounded-2xl p-6 md:p-8 space-y-6 max-w-2xl shadow-lg shadow-rose-950/5 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400 shrink-0">
                  <AlertCircle size={22} />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <h3 className="font-bold text-white text-base leading-tight">
                    {t('noSeatingAlert', lang)}
                  </h3>
                  <p className="text-xs text-rose-400/90 leading-relaxed">
                    {lang === 'en' 
                      ? 'You are not registered in the exam listing for this semester. Please submit a petition request before the university deadline.' 
                      : 'ไม่พบรายชื่อผู้มีสิทธิ์เข้าสอบของท่านในระบบประจำภาคการศึกษานี้ โปรดยื่นเอกสารคำร้องขอเข้าสอบตามขั้นตอนให้เสร็จสิ้นภายในกำหนดเวลา'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-rose-500/10 pt-5">
                <a 
                  href={unlistedInfo.pdfLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-dark-sidebar/40 hover:bg-dark-hover border border-rose-500/20 text-white font-medium text-xs py-3 px-4 rounded-xl transition-all cursor-pointer shadow-sm hover:translate-y-0.5 active:scale-98"
                >
                  <FileText size={14} className="text-rose-400" />
                  {t('noSeatingAction1', lang)}
                  <ExternalLink size={11} className="text-dark-muted" />
                </a>
                <a 
                  href={unlistedInfo.formLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer shadow-md hover:translate-y-0.5 active:scale-98"
                >
                  <ClipboardCheck size={14} className="text-rose-400" />
                  {t('noSeatingAction2', lang)}
                  <ExternalLink size={11} className="text-rose-300/60" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Exam Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-dark-border/40">
              <h3 className="font-semibold font-heading text-sm text-white flex items-center gap-2">
                <ClipboardCheck size={16} className="text-brand-400" />
                {editingExamId ? t('examFormEditTitle', lang) : t('examFormTitle', lang)}
              </h3>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveManualExam} className="p-5 space-y-4 text-xs">
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
                    placeholder="e.g. 13:00-16:00"
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
                    placeholder="e.g. 78-216"
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    className="w-full bg-dark-sidebar border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500/60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">{t('seatLabel', lang)}</label>
                  <input
                    type="text"
                    placeholder="e.g. Row 4 Seat 10"
                    value={formSeat}
                    onChange={(e) => setFormSeat(e.target.value)}
                    className="w-full bg-dark-sidebar border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500/60"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-dark-border/40 mt-5">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-dark-muted hover:text-white hover:bg-dark-hover transition-colors cursor-pointer"
                >
                  {t('cancelBtn', lang)}
                </button>
                <button
                  type="submit"
                  className="bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs px-5 py-2 rounded-xl transition-colors cursor-pointer shadow-md shadow-brand-500/10 active:scale-98"
                >
                  {t('saveBtn', lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
