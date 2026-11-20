import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Eye, EyeOff, Upload, CalendarDays, CheckCircle2,
  AlertTriangle, TrendingUp, TrendingDown, BookOpen, Calculator,
  SlidersHorizontal, ChevronDown, ChevronUp, Plus, Trash2, Search,
  RotateCcw, ShieldCheck, X, Award, RefreshCw
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useToast } from '../hooks/useToast';
import RegImportModal from '../components/RegImportModal';
import { decodeRegImportHashPayload } from '../services/parsers/kmutnbRegParser';
import {
  CURRICULUM_PRESETS,
  SIMULATOR_GRADE_OPTIONS,
  computeAcademicSummary,
  computeGraduationProgress,
  formatGpa,
  simulateWhatIfGpa,
  solveRequiredTermGpa
} from '../utils/academicUtils';

const CATEGORY_COLORS = [
  '#3794FF', '#4EC9B0', '#C586C0', '#CCA700', '#CE9178', '#F14C4C', '#2D9D78', '#569CD6'
];

function getGradeBadgeClass(grade) {
  const g = String(grade || '').toUpperCase();
  if (g === 'A' || g === 'S') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (g === 'B+' || g === 'B') return 'bg-[#007ACC]/20 text-[#3794FF] border-[#007ACC]/40';
  if (g === 'C+' || g === 'C') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (g === 'D+' || g === 'D') return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
  if (g === 'F' || g === 'U' || g === 'FA' || g === 'FE') return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  return 'bg-[#1E1E1E] text-[#9D9D9D] border-[#3C3C3C]';
}

function getStandingBadge(standing, isTh) {
  switch (standing) {
    case 'first_honors':
      return {
        label: isTh ? 'เกณฑ์เกียรตินิยมอันดับ 1' : '1st Class Honors Track',
        cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      };
    case 'second_honors':
      return {
        label: isTh ? 'เกณฑ์เกียรตินิยมอันดับ 2' : '2nd Class Honors Track',
        cls: 'bg-[#007ACC]/20 text-[#3794FF] border-[#007ACC]/40'
      };
    case 'probation':
      return {
        label: isTh ? 'ระวังเกณฑ์จบ (< 2.00)' : 'Below Graduation Min (< 2.00)',
        cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      };
    case 'dismissal_risk':
      return {
        label: isTh ? 'เสี่ยงพ้นสภาพ (< 1.50)' : 'Critical Standing (< 1.50)',
        cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      };
    case 'normal':
      return {
        label: isTh ? 'สถานะปกติ (≥ 2.00)' : 'Good Standing (≥ 2.00)',
        cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      };
    default:
      return null;
  }
}

// ─── INLINE SVG GPA TREND CHART ─────────────────────────────────────
function GpaTrendChart({ gradedSemesters, blur, isTh }) {
  if (!gradedSemesters || gradedSemesters.length === 0) return null;

  const width = 620;
  const height = 210;
  const padLeft = 38;
  const padRight = 24;
  const padTop = 22;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const xAt = (idx) => {
    if (gradedSemesters.length === 1) return padLeft + plotW / 2;
    return padLeft + (idx / (gradedSemesters.length - 1)) * plotW;
  };
  const yAt = (val) => {
    const clamped = Math.min(4, Math.max(0, Number(val) || 0));
    return padTop + plotH - (clamped / 4) * plotH;
  };

  const gpaPoints = gradedSemesters.map((s, idx) => ({
    x: xAt(idx),
    y: yAt(s.computedStats.gpa),
    val: s.computedStats.gpa,
    label: s.semesterId,
  }));
  const gpaxPoints = gradedSemesters.map((s, idx) => ({
    x: xAt(idx),
    y: yAt(s.computedCumulative.gpax),
    val: s.computedCumulative.gpax,
    label: s.semesterId,
  }));

  const gpaPath = gpaPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const gpaxPath = gpaxPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#FFFFFF] flex items-center gap-2">
          <TrendingUp size={15} className="text-[#3794FF]" />
          <span>{isTh ? 'แนวโน้มเกรดรายเทอม (GPA & GPAX)' : 'Semester GPA & GPAX Trend'}</span>
        </h3>
        <div className="flex items-center gap-4 text-[11px] text-[#9D9D9D]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#3794FF] inline-block" />
            <span>GPA {isTh ? 'รายเทอม' : 'Term'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-[#4EC9B0] inline-block" />
            <span>GPAX {isTh ? 'สะสม' : 'Cumulative'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dotted border-amber-400/70 inline-block" />
            <span>{isTh ? 'เกณฑ์จบ 2.00' : 'Min 2.00'}</span>
          </span>
        </div>
      </div>

      <div className={`w-full overflow-x-auto transition-all ${blur ? 'blur-sm select-none pointer-events-none' : ''}`}>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[420px] h-auto" role="img" aria-label="GPA Trend Chart">
          {/* Horizontal grid lines */}
          {[0, 1, 2, 3, 4].map((tick) => {
            const y = yAt(tick);
            const isMinLine = tick === 2;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={isMinLine ? '#F59E0B' : '#3C3C3C'}
                  strokeOpacity={isMinLine ? 0.55 : 0.6}
                  strokeDasharray={isMinLine ? '4 4' : undefined}
                  strokeWidth={1}
                />
                <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill={isMinLine ? '#FBBF24' : '#858585'}>
                  {tick.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* GPAX cumulative line */}
          {gpaxPoints.length > 1 && (
            <path d={gpaxPath} fill="none" stroke="#4EC9B0" strokeWidth={2} strokeDasharray="5 4" />
          )}

          {/* Term GPA line */}
          {gpaPoints.length > 1 && (
            <path d={gpaPath} fill="none" stroke="#3794FF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Dots & labels */}
          {gpaPoints.map((p, idx) => (
            <g key={p.label}>
              <circle cx={gpaxPoints[idx].x} cy={gpaxPoints[idx].y} r={3.5} fill="#4EC9B0" stroke="#1E1E1E" strokeWidth={1.5} />
              <circle cx={p.x} cy={p.y} r={4.5} fill="#3794FF" stroke="#1E1E1E" strokeWidth={1.5} />
              <text x={p.x} y={Math.max(12, p.y - 9)} textAnchor="middle" fontSize="10" fontWeight="600" fill="#FFFFFF">
                {formatGpa(p.val)}
              </text>
              <text x={p.x} y={height - 10} textAnchor="middle" fontSize="10" fill="#9D9D9D">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ─── CURRICULUM CRITERIA EDITOR MODAL ───────────────────────────────
function CurriculumEditorModal({ isOpen, curriculum, minGpax, isTh, onSave, onClose }) {
  const [categories, setCategories] = useState(() =>
    (curriculum || []).map((c) => ({ ...c }))
  );
  const [targetMinGpax, setTargetMinGpax] = useState(() => String(minGpax ?? 2.0));

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalCredits = categories.reduce((sum, c) => sum + (Math.max(0, Number(c.requiredCredits) || 0)), 0);

  const handleApplyPreset = (preset) => {
    setCategories(preset.categories.map((c) => ({ ...c })));
    setTargetMinGpax(String(preset.minGpax));
  };

  const handleUpdateCat = (idx, field, val) => {
    setCategories((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const handleAddCat = () => {
    const id = `cat_${Date.now()}`;
    setCategories((prev) => [
      ...prev,
      {
        id,
        nameTh: 'หมวดวิชาใหม่',
        nameEn: 'New Category',
        requiredCredits: 6,
        color: CATEGORY_COLORS[prev.length % CATEGORY_COLORS.length],
      },
    ]);
  };

  const handleRemoveCat = (idx) => {
    if (categories.length <= 1) return;
    setCategories((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = categories
      .filter((c) => (c.nameTh || c.nameEn || '').trim())
      .map((c) => ({
        ...c,
        nameTh: (c.nameTh || c.nameEn).trim(),
        nameEn: (c.nameEn || c.nameTh).trim(),
        requiredCredits: Math.max(0, parseInt(c.requiredCredits, 10) || 0),
      }));
    const parsedMinGpax = Math.min(4.0, Math.max(1.0, parseFloat(targetMinGpax) || 2.0));
    onSave(cleaned, parsedMinGpax);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={isTh ? 'ตั้งค่าเกณฑ์จบหลักสูตร' : 'Edit Graduation Criteria'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[#252526] border border-[#3C3C3C] rounded-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-[#3C3C3C] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#FFFFFF] flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-[#3794FF]" />
              <span>{isTh ? 'ตั้งค่าเกณฑ์จบหลักสูตรของสาขา' : 'Customize Graduation Criteria'}</span>
            </h2>
            <p className="text-[11px] text-[#9D9D9D] mt-0.5">
              {isTh ? `หน่วยกิตรวมตามเกณฑ์ปัจจุบัน: ${totalCredits} หน่วยกิต` : `Total required credits: ${totalCredits} cr`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-[#9D9D9D]">
              {isTh ? 'เลือกแม่แบบหลักสูตร มจพ.:' : 'KMUTNB Presets:'}
            </span>
            <div className="flex flex-wrap gap-2">
              {CURRICULUM_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#1E1E1E] border border-[#3C3C3C] hover:border-[#007ACC] text-[#D4D4D4] transition-colors cursor-pointer"
                >
                  {isTh ? preset.labelTh : preset.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Min GPAX */}
          <div className="flex items-center justify-between gap-3 bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3.5 py-2.5">
            <label htmlFor="min-gpax-input" className="text-xs font-medium text-[#D4D4D4]">
              {isTh ? 'เกณฑ์ GPAX ขั้นต่ำจบการศึกษา' : 'Minimum Graduation GPAX'}
            </label>
            <input
              id="min-gpax-input"
              type="number"
              step="0.05"
              min="1.00"
              max="4.00"
              value={targetMinGpax}
              onChange={(e) => setTargetMinGpax(e.target.value)}
              className="w-24 bg-[#252526] border border-[#3C3C3C] rounded-lg px-2.5 py-1 text-xs text-right text-[#FFFFFF] font-mono"
            />
          </div>

          {/* Category rows */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#D4D4D4]">
                {isTh ? 'หมวดรายวิชา & หน่วยกิตที่ต้องผ่าน' : 'Curriculum Categories & Credits'}
              </span>
              <button
                type="button"
                onClick={handleAddCat}
                className="text-xs text-[#3794FF] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>{isTh ? 'เพิ่มหมวด' : 'Add Category'}</span>
              </button>
            </div>

            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                className="flex items-center gap-2 bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-2.5"
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#3794FF' }} />
                <input
                  type="text"
                  value={isTh ? cat.nameTh : cat.nameEn}
                  onChange={(e) => handleUpdateCat(idx, isTh ? 'nameTh' : 'nameEn', e.target.value)}
                  className="flex-1 min-w-0 bg-[#252526] border border-[#3C3C3C] rounded-lg px-2.5 py-1.5 text-xs text-[#FFFFFF]"
                  placeholder={isTh ? 'ชื่อหมวดวิชา' : 'Category name'}
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={cat.requiredCredits}
                    onChange={(e) => handleUpdateCat(idx, 'requiredCredits', e.target.value)}
                    aria-label="Required credits"
                    className="w-16 bg-[#252526] border border-[#3C3C3C] rounded-lg px-2 py-1.5 text-xs text-right text-[#FFFFFF] font-mono"
                  />
                  <span className="text-[11px] text-[#858585]">{isTh ? 'นก.' : 'cr'}</span>
                </div>
                <button
                  type="button"
                  disabled={categories.length <= 1}
                  onClick={() => handleRemoveCat(idx)}
                  aria-label="Delete category"
                  className="p-1.5 rounded-lg text-[#858585] hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[#3C3C3C] bg-[#1E1E1E] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-[#252526] border border-[#3C3C3C] text-[#D4D4D4] hover:bg-[#2A2D2E] cursor-pointer"
          >
            {isTh ? 'ยกเลิก' : 'Cancel'}
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-medium bg-[#007ACC] hover:bg-[#1177BB] text-white cursor-pointer"
          >
            {isTh ? 'บันทึกเกณฑ์หลักสูตร' : 'Save Criteria'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── MAIN ACADEMIC & GRADUATION PAGE ────────────────────────────────
export default function Academic() {
  const { lang } = useSettings();
  const { academicData, handleSaveAcademicData } = useClassroom();
  const { addToast } = useToast();

  // Safely read & immediately scrub #reg-import=... bookmarklet payload from URL history
  const [bookmarkletInitialText, setBookmarkletInitialText] = useState(() => {
    if (typeof window === 'undefined') return '';
    const hash = window.location.hash || '';
    if (!hash.startsWith('#reg-import=')) return '';
    const decoded = decodeRegImportHashPayload(hash.slice('#reg-import='.length));
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      // Ignore in restricted history contexts
    }
    return decoded;
  });

  const [isImportOpen, setIsImportOpen] = useState(() => Boolean(bookmarkletInitialText));
  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview | grades | passed | simulator
  const [expandedCategories, setExpandedCategories] = useState({});
  const [gradeSearch, setGradeSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all'); // all | high | pass | fail
  const [newestFirst, setNewestFirst] = useState(true);
  const [auditFilter, setAuditFilter] = useState('all'); // all | passed | in_progress | failed
  const [confirmClear, setConfirmClear] = useState(false);

  // What-if Simulator local state
  const [simCourses, setSimCourses] = useState([]);
  const [simInitializedKey, setSimInitializedKey] = useState('');
  const [targetGpax, setTargetGpax] = useState('2.50');

  const isTh = lang === 'th';
  const privacyBlur = Boolean(academicData?.privacyBlur);
  const blurCls = privacyBlur ? 'blur-sm select-none' : '';

  const summary = useMemo(
    () => computeAcademicSummary(academicData?.semesters || [], academicData?.enrolledCourses || []),
    [academicData?.semesters, academicData?.enrolledCourses]
  );

  const gradProgress = useMemo(
    () =>
      computeGraduationProgress(
        summary.allCourseAudits,
        academicData?.curriculum,
        academicData?.courseCategoryMap,
        academicData?.minGpax ?? 2.0,
        summary.gpax
      ),
    [summary.allCourseAudits, academicData?.curriculum, academicData?.courseCategoryMap, academicData?.minGpax, summary.gpax]
  );

  // Sync simulator courses when enrolled courses first arrive or change on import
  const enrolledKey = useMemo(
    () => (academicData?.enrolledCourses || []).map((c) => `${c.courseCode}:${c.credits}`).join('|'),
    [academicData?.enrolledCourses]
  );

  if (enrolledKey !== simInitializedKey) {
    setSimInitializedKey(enrolledKey);
    const enrolled = academicData?.enrolledCourses || [];
    if (enrolled.length > 0) {
      setSimCourses(
        enrolled.map((c) => ({
          id: `sim-${c.courseCode}`,
          courseCode: c.courseCode,
          courseName: c.engName || c.thaiName || c.courseCode,
          credits: Number(c.credits) || 3,
          grade: 'B',
          isRetake: summary.retakingCourses.some((r) => r.courseCode === c.courseCode),
        }))
      );
    }
  }

  const simResult = useMemo(
    () => simulateWhatIfGpa(summary.totalCG, summary.totalGP, summary.uniquePassedCredits, simCourses),
    [summary.totalCG, summary.totalGP, summary.uniquePassedCredits, simCourses]
  );

  const plannedSimCredits = useMemo(
    () => simCourses.filter((c) => c.grade !== 'W').reduce((sum, c) => sum + (Number(c.credits) || 0), 0),
    [simCourses]
  );

  const targetSolver = useMemo(
    () => solveRequiredTermGpa(summary.totalCG, summary.totalGP, plannedSimCredits || 18, parseFloat(targetGpax) || 2.5),
    [summary.totalCG, summary.totalGP, plannedSimCredits, targetGpax]
  );

  const hasAnyData =
    (academicData?.semesters?.length || 0) > 0 || (academicData?.enrolledCourses?.length || 0) > 0;

  const standingBadge = getStandingBadge(summary.standing, isTh);

  const handleToggleBlur = () => {
    handleSaveAcademicData((prev) => ({ ...prev, privacyBlur: !prev.privacyBlur }));
  };

  const handleChangeCourseCategory = (courseCode, newCategoryId) => {
    handleSaveAcademicData((prev) => ({
      ...prev,
      courseCategoryMap: {
        ...(prev.courseCategoryMap || {}),
        [courseCode]: newCategoryId,
      },
    }));
  };

  const handleSaveCurriculum = (nextCategories, nextMinGpax) => {
    handleSaveAcademicData((prev) => ({
      ...prev,
      curriculum: nextCategories,
      minGpax: nextMinGpax,
    }));
    addToast(isTh ? 'บันทึกเกณฑ์จบหลักสูตรแล้ว' : 'Graduation criteria saved', 'success');
  };

  const handleClearAcademic = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    handleSaveAcademicData((prev) => ({
      ...prev,
      semesters: [],
      enrolledCourses: [],
      courseCategoryMap: {},
      lastImportedAt: null,
    }));
    setSimCourses([]);
    setConfirmClear(false);
    addToast(isTh ? 'ล้างข้อมูลผลการเรียนแล้ว' : 'Academic data cleared', 'info');
  };

  const handleAddSimCourse = () => {
    setSimCourses((prev) => [
      ...prev,
      {
        id: `sim-custom-${Date.now()}`,
        courseCode: '',
        courseName: isTh ? `รายวิชาที่ ${prev.length + 1}` : `Course ${prev.length + 1}`,
        credits: 3,
        grade: 'B',
        isRetake: false,
      },
    ]);
  };

  const handleReloadEnrolledIntoSim = () => {
    const enrolled = academicData?.enrolledCourses || [];
    setSimCourses(
      enrolled.map((c) => ({
        id: `sim-${c.courseCode}`,
        courseCode: c.courseCode,
        courseName: c.engName || c.thaiName || c.courseCode,
        credits: Number(c.credits) || 3,
        grade: 'B',
        isRetake: summary.retakingCourses.some((r) => r.courseCode === c.courseCode),
      }))
    );
  };

  const displaySemesters = useMemo(() => {
    const base = newestFirst ? [...summary.semesters].reverse() : [...summary.semesters];
    const q = gradeSearch.trim().toLowerCase();

    return base
      .map((sem) => {
        const filteredCourses = (sem.courses || []).filter((c) => {
          if (q) {
            const matchText =
              String(c.courseCode || '').toLowerCase().includes(q) ||
              String(c.courseName || '').toLowerCase().includes(q);
            if (!matchText) return false;
          }
          if (gradeFilter === 'high') return ['A', 'B+', 'B', 'S'].includes(c.grade);
          if (gradeFilter === 'pass') return ['C+', 'C', 'D+', 'D'].includes(c.grade);
          if (gradeFilter === 'fail') return ['F', 'W', 'U', 'FA', 'FE'].includes(c.grade);
          return true;
        });
        return { ...sem, filteredCourses };
      })
      .filter((sem) => {
        if (!q && gradeFilter === 'all') return true;
        return sem.filteredCourses.length > 0;
      });
  }, [summary.semesters, newestFirst, gradeSearch, gradeFilter]);

  const filteredAuditCourses = useMemo(() => {
    const q = gradeSearch.trim().toLowerCase();
    return summary.allCourseAudits.filter((c) => {
      if (auditFilter === 'passed' && c.status !== 'passed') return false;
      if (auditFilter === 'in_progress' && c.status !== 'in_progress' && c.status !== 'retaking') return false;
      if (auditFilter === 'failed' && c.status !== 'failed' && c.status !== 'withdrawn') return false;
      if (q) {
        return (
          c.courseCode.toLowerCase().includes(q) ||
          String(c.courseName || '').toLowerCase().includes(q) ||
          String(c.thaiName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [summary.allCourseAudits, auditFilter, gradeSearch]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-[#3C3C3C] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#FFFFFF] flex items-center gap-2.5 tracking-tight">
            <GraduationCap size={23} className="text-[#3794FF]" />
            <span>{isTh ? 'ผลการเรียน & เกณฑ์จบหลักสูตร' : 'Academic & Graduation Tracker'}</span>
          </h1>
          <p className="text-xs text-[#9D9D9D] mt-1 leading-relaxed">
            {isTh
              ? 'สรุปเกรดรายเทอม คำนวณหน่วยกิตที่ผ่านแล้วเทียบเกณฑ์จบหลักสูตร และซิงค์ตารางเรียนจาก KMUTNB Reg'
              : 'Track semester grades, passed credits toward graduation, and sync your timetable from KMUTNB Reg.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
          {hasAnyData && (
            <button
              type="button"
              onClick={handleToggleBlur}
              aria-pressed={privacyBlur}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                privacyBlur
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-[#252526] border-[#3C3C3C] text-[#D4D4D4] hover:bg-[#2A2D2E]'
              }`}
              title={isTh ? 'เบลอตัวเลขเกรดและ GPAX' : 'Blur grades & GPAX'}
            >
              {privacyBlur ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>{privacyBlur ? (isTh ? 'แสดงเกรด' : 'Show Grades') : (isTh ? 'ซ่อนเกรด' : 'Hide Grades')}</span>
            </button>
          )}

          {(academicData?.enrolledCourses?.length || 0) > 0 && (
            <Link
              to="/schedule"
              className="flex items-center gap-1.5 bg-[#252526] border border-[#3C3C3C] hover:bg-[#2A2D2E] text-[#D4D4D4] font-medium text-xs px-3.5 py-2.5 rounded-xl transition-colors"
            >
              <CalendarDays size={14} className="text-[#3794FF]" />
              <span>{isTh ? 'ตารางเรียน' : 'Schedule'}</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => {
              setBookmarkletInitialText('');
              setIsImportOpen(true);
            }}
            className="flex items-center gap-1.5 bg-[#007ACC] hover:bg-[#1177BB] text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Upload size={14} />
            <span>{isTh ? 'นำเข้าจาก Reg มจพ.' : 'Import KMUTNB Reg'}</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {!hasAnyData ? (
        <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-8 md:p-10 text-center max-w-2xl mx-auto space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-[#007ACC]/20 border border-[#007ACC]/30 text-[#3794FF] flex items-center justify-center mx-auto">
            <GraduationCap size={28} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-[#FFFFFF]">
              {isTh ? 'เริ่มต้นเชื่อมข้อมูลจาก reg.kmutnb.ac.th' : 'Import Your KMUTNB Academic Records'}
            </h2>
            <p className="text-xs text-[#9D9D9D] max-w-md mx-auto leading-relaxed">
              {isTh
                ? 'ก๊อปวางหน้า "ผลการศึกษา" และหน้า "ตารางเรียน/สอบ" ในคลิกเดียว เพื่อดูเกรดรายเทอม นับรายวิชาที่ผ่านแล้วเทียบเกณฑ์จบ และดึงตารางเรียน+วันสอบลงปฏิทินอัตโนมัติ'
                : 'Copy-paste your Grade Report and Timetable from reg.kmutnb.ac.th to automatically track GPA, graduation requirements, class schedule, and exam dates.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left text-xs">
            <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-3.5 space-y-1">
              <span className="text-[#3794FF] font-semibold">1. {isTh ? 'เปิดเว็บ Reg มจพ.' : 'Open KMUTNB Reg'}</span>
              <p className="text-[11px] text-[#9D9D9D]">
                {isTh ? 'ล็อกอินบัญชี ICIT ของคุณเองที่ reg.kmutnb.ac.th' : 'Sign in directly on reg.kmutnb.ac.th'}
              </p>
            </div>
            <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-3.5 space-y-1">
              <span className="text-emerald-400 font-semibold">2. {isTh ? 'กด Ctrl+A แล้ว Ctrl+C' : 'Press Ctrl+A → Ctrl+C'}</span>
              <p className="text-[11px] text-[#9D9D9D]">
                {isTh ? 'คัดลอกหน้า ตารางเรียน/สอบ และ ผลการศึกษา' : 'Copy Timetable and/or Grade Report pages'}
              </p>
            </div>
            <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-3.5 space-y-1">
              <span className="text-purple-400 font-semibold">3. {isTh ? 'วางและกดยืนยัน' : 'Paste & Confirm'}</span>
              <p className="text-[11px] text-[#9D9D9D]">
                {isTh ? 'แกะข้อมูลฝั่งเครื่อง 100% ปลอดภัย ไม่เก็บชื่อ/รหัส นศ.' : '100% client-side parsing with automatic PII stripping'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-2 bg-[#007ACC] hover:bg-[#1177BB] text-white font-medium text-xs px-5 py-3 rounded-xl transition-colors cursor-pointer"
          >
            <Upload size={15} />
            <span>{isTh ? 'นำเข้าจาก KMUTNB Reg ตอนนี้' : 'Import from KMUTNB Reg Now'}</span>
          </button>

          <p className="text-[11px] text-[#858585] flex items-center justify-center gap-1.5 pt-2">
            <ShieldCheck size={13} className="text-emerald-400" />
            <span>
              {isTh
                ? 'เก็บข้อมูลเฉพาะใน Google Drive ส่วนตัว (appDataFolder) และล้างออกจากเครื่องทันทีเมื่อกดออกจากระบบ'
                : 'Synced privately to your Google Drive appDataFolder and wiped locally on logout.'}
            </span>
          </p>
        </div>
      ) : (
        <>
          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: GPAX */}
            <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#9D9D9D]">
                <span>{isTh ? 'เกรดเฉลี่ยสะสม (GPAX)' : 'Cumulative GPAX'}</span>
                <Award size={15} className="text-[#3794FF]" />
              </div>
              <div className={`text-3xl font-bold text-[#FFFFFF] tracking-tight font-mono ${blurCls}`}>
                {formatGpa(summary.gpax)}
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {standingBadge && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${standingBadge.cls}`}>
                    {standingBadge.label}
                  </span>
                )}
                <span className={`text-[11px] text-[#858585] font-mono ${blurCls}`}>
                  GP {summary.totalGP} / CG {summary.totalCG}
                </span>
              </div>
            </div>

            {/* KPI 2: Passed Credits vs Graduation Requirement */}
            <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#9D9D9D]">
                <span>{isTh ? 'หน่วยกิตผ่านสะสม' : 'Passed Credits'}</span>
                <CheckCircle2 size={15} className="text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-[#FFFFFF] font-mono">{gradProgress.totalPassed}</span>
                <span className="text-sm text-[#858585] font-mono">/ {gradProgress.totalRequired}</span>
                <span className="text-xs text-emerald-400 font-semibold ml-auto">
                  {gradProgress.overallPassedPct}%
                </span>
              </div>
              <div className="text-[11px] text-[#9D9D9D] flex items-center gap-2 flex-wrap">
                <span>
                  {summary.passedCourses.length} {isTh ? 'วิชาที่ผ่านแล้ว' : 'passed courses'}
                </span>
                {gradProgress.totalInProgress > 0 && (
                  <span className="text-[#3794FF] font-medium">
                    +{gradProgress.totalInProgress} {isTh ? 'กำลังเรียน' : 'in progress'}
                  </span>
                )}
              </div>
            </div>

            {/* KPI 3: Retake / Failed Courses */}
            <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#9D9D9D]">
                <span>{isTh ? 'วิชาไม่ผ่าน / รีเกรด' : 'Failed / Retakes'}</span>
                <AlertTriangle
                  size={15}
                  className={summary.failedCourses.length > 0 ? 'text-rose-400' : 'text-emerald-400'}
                />
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-bold font-mono ${
                    summary.failedCourses.length > 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {summary.failedCourses.length}
                </span>
                <span className="text-xs text-[#9D9D9D]">
                  {isTh ? 'วิชาที่ยังติด F' : 'unresolved F'}
                </span>
              </div>
              <div className="text-[11px] text-[#9D9D9D]">
                {summary.retakingCourses.length > 0 ? (
                  <span className="text-[#3794FF] font-medium">
                    {isTh
                      ? `กำลังลงรีเกรดเทอมนี้ ${summary.retakingCourses.length} วิชา`
                      : `Retaking ${summary.retakingCourses.length} this term`}
                  </span>
                ) : (
                  <span>
                    {summary.failedCourses.length === 0
                      ? (isTh ? 'ไม่มีวิชาติด F ค้างอยู่' : 'No unresolved failed courses')
                      : (isTh ? 'ควรวางแผนลงเรียนใหม่' : 'Plan to retake soon')}
                  </span>
                )}
              </div>
            </div>

            {/* KPI 4: Latest Term GPA */}
            <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#9D9D9D]">
                <span>
                  {isTh ? 'GPA เทอมล่าสุด' : 'Latest Term GPA'}
                  {summary.latestSemesterId ? ` (${summary.latestSemesterId})` : ''}
                </span>
                {summary.gpaDelta !== null && summary.gpaDelta < 0 ? (
                  <TrendingDown size={15} className="text-rose-400" />
                ) : (
                  <TrendingUp size={15} className="text-emerald-400" />
                )}
              </div>
              <div className={`text-3xl font-bold text-[#FFFFFF] font-mono ${blurCls}`}>
                {formatGpa(summary.latestGpa)}
              </div>
              <div className={`text-[11px] ${blurCls}`}>
                {summary.gpaDelta !== null ? (
                  <span className={summary.gpaDelta >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                    {summary.gpaDelta >= 0 ? `+${summary.gpaDelta.toFixed(2)}` : summary.gpaDelta.toFixed(2)}{' '}
                    {isTh ? 'เทียบกับเทอมก่อน' : 'vs previous term'}
                  </span>
                ) : (
                  <span className="text-[#858585]">
                    {summary.gradedSemesters.length} {isTh ? 'เทอมที่มีเกรด' : 'graded terms'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex bg-[#252526] border border-[#3C3C3C] p-1 rounded-xl gap-1 overflow-x-auto max-w-full">
              {[
                { id: 'overview', icon: GraduationCap, labelTh: 'เกณฑ์จบ & ภาพรวม', labelEn: 'Graduation & Overview' },
                { id: 'grades', icon: BookOpen, labelTh: `เกรดรายเทอม (${summary.semesters.length})`, labelEn: `Semesters (${summary.semesters.length})` },
                { id: 'passed', icon: CheckCircle2, labelTh: `รายวิชาที่ผ่านแล้ว (${summary.passedCourses.length})`, labelEn: `Passed Audit (${summary.passedCourses.length})` },
                { id: 'simulator', icon: Calculator, labelTh: 'จำลองเกรด What-if', labelEn: 'GPA Simulator' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-[#094771]/70 text-[#FFFFFF] border border-[#007ACC]/50'
                      : 'text-[#9D9D9D] hover:text-[#D4D4D4]'
                  }`}
                >
                  <tab.icon size={14} />
                  <span>{isTh ? tab.labelTh : tab.labelEn}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCurriculumModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#252526] border border-[#3C3C3C] text-[#D4D4D4] hover:bg-[#2A2D2E] transition-colors cursor-pointer"
              >
                <SlidersHorizontal size={13} className="text-[#3794FF]" />
                <span>{isTh ? 'แก้ไขเกณฑ์จบ' : 'Edit Criteria'}</span>
              </button>
              <button
                type="button"
                onClick={handleClearAcademic}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  confirmClear
                    ? 'bg-rose-600 border-rose-600 text-white'
                    : 'bg-[#252526] border-[#3C3C3C] text-[#9D9D9D] hover:text-rose-400'
                }`}
              >
                <Trash2 size={13} />
                <span>{confirmClear ? (isTh ? 'กดอีกครั้งเพื่อยืนยันลบ' : 'Confirm Clear') : (isTh ? 'ล้างข้อมูล' : 'Clear')}</span>
              </button>
              {confirmClear && (
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2.5 py-2 rounded-xl text-xs bg-[#252526] border border-[#3C3C3C] text-[#D4D4D4] cursor-pointer"
                >
                  {isTh ? 'ยกเลิก' : 'Cancel'}
                </button>
              )}
            </div>
          </div>

          {/* ══ TAB 1: GRADUATION & OVERVIEW ══════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Overall Graduation Progress Card */}
              <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5 md:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-[#FFFFFF]">
                      {isTh ? 'ความคืบหน้าเกณฑ์จบหลักสูตร' : 'Graduation Requirements Progress'}
                    </h2>
                    <p className="text-xs text-[#9D9D9D] mt-0.5">
                      {isTh
                        ? `ผ่านแล้ว ${gradProgress.totalPassed} นก. จาก ${gradProgress.totalRequired} นก. (ขาดอีก ${gradProgress.remainingCredits} นก.${
                            gradProgress.totalInProgress > 0
                              ? ` • ถ้าผ่านเทอมนี้หมดจะเหลืออีก ${gradProgress.remainingWithEnrolled} นก.`
                              : ''
                          })`
                        : `Passed ${gradProgress.totalPassed} of ${gradProgress.totalRequired} credits (${gradProgress.remainingCredits} remaining${
                            gradProgress.totalInProgress > 0
                              ? ` • ${gradProgress.remainingWithEnrolled} left if current term passes`
                              : ''
                          })`}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full self-start sm:self-auto">
                    {gradProgress.overallPassedPct}% {isTh ? 'สำเร็จแล้ว' : 'Completed'}
                    {gradProgress.totalInProgress > 0 && ` → ${gradProgress.overallProjectedPct}%`}
                  </span>
                </div>

                {/* Dual-segment progress bar */}
                <div className="space-y-2">
                  <div className="h-3.5 w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-[#007ACC]/55 transition-all duration-500 absolute left-0 top-0"
                      style={{ width: `${gradProgress.overallProjectedPct}%` }}
                    />
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500 absolute left-0 top-0"
                      style={{ width: `${gradProgress.overallPassedPct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#9D9D9D]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>
                        {isTh ? `ผ่านแล้ว: ${gradProgress.totalPassed} นก.` : `Passed: ${gradProgress.totalPassed} cr`}
                      </span>
                    </span>
                    {gradProgress.totalInProgress > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#007ACC]" />
                        <span>
                          {isTh
                            ? `กำลังลงเทอมนี้: +${gradProgress.totalInProgress} นก.`
                            : `In progress: +${gradProgress.totalInProgress} cr`}
                        </span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#3C3C3C]" />
                      <span>
                        {isTh
                          ? `เหลืออีก: ${gradProgress.remainingWithEnrolled} นก.`
                          : `Still needed: ${gradProgress.remainingWithEnrolled} cr`}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Graduation Conditions Checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-[#3C3C3C]">
                  {[
                    {
                      ok: gradProgress.checklist.creditsMet,
                      labelTh: `หน่วยกิตผ่าน ≥ ${gradProgress.totalRequired} นก.`,
                      labelEn: `Passed ≥ ${gradProgress.totalRequired} cr`,
                    },
                    {
                      ok: gradProgress.checklist.allCategoriesMet,
                      labelTh: 'ครบทุกหมวดหมู่หลักสูตร',
                      labelEn: 'All categories fulfilled',
                    },
                    {
                      ok: gradProgress.checklist.gpaxMet,
                      labelTh: `GPAX ≥ ${(academicData?.minGpax ?? 2.0).toFixed(2)}`,
                      labelEn: `GPAX ≥ ${(academicData?.minGpax ?? 2.0).toFixed(2)}`,
                    },
                    {
                      ok: gradProgress.checklist.noUnresolvedFails,
                      labelTh: 'ไม่มีวิชาติด F ค้างแก้',
                      labelEn: 'No unresolved F grades',
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${
                        item.ok
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-[#1E1E1E] border-[#3C3C3C] text-[#9D9D9D]'
                      }`}
                    >
                      {item.ok ? (
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                      )}
                      <span className="truncate">{isTh ? item.labelTh : item.labelEn}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Failed & Retaking Alert Card */}
              {(summary.failedCourses.length > 0 || summary.retakingCourses.length > 0 || summary.withdrawnCourses.length > 0) && (
                <div className="bg-[#252526] border border-rose-500/30 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-[#FFFFFF] flex items-center gap-2">
                    <AlertTriangle size={15} className="text-rose-400" />
                    <span>{isTh ? 'ติดตามรายวิชาที่ไม่ผ่าน / รีเกรด / ถอน (W)' : 'Failed, Retaking & Withdrawn Courses'}</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {summary.failedCourses.map((c) => (
                      <div
                        key={c.courseCode}
                        className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-rose-300 font-semibold">{c.courseCode}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-medium">
                              {isTh ? 'ต้องลงแก้' : 'Needs Retake'}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-[#FFFFFF] truncate mt-0.5">{c.courseName}</p>
                          <p className="text-[11px] text-[#9D9D9D] mt-0.5">
                            {c.attempts.map((a) => `${a.semesterId}: ${a.grade}`).join(' → ')}
                          </p>
                        </div>
                        <span className="text-xs font-mono text-[#D4D4D4] shrink-0">{c.credits} {isTh ? 'นก.' : 'cr'}</span>
                      </div>
                    ))}

                    {summary.retakingCourses.map((c) => (
                      <div
                        key={c.courseCode}
                        className="bg-[#007ACC]/15 border border-[#007ACC]/40 rounded-xl p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-[#3794FF] font-semibold">{c.courseCode}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#007ACC]/30 text-[#3794FF] font-medium">
                              {isTh ? 'กำลังลงรีเกรดเทอมนี้' : 'Retaking Now'}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-[#FFFFFF] truncate mt-0.5">
                            {c.engName || c.courseName}
                          </p>
                          <p className="text-[11px] text-[#9D9D9D] mt-0.5">
                            {c.attempts.map((a) => `${a.semesterId}: ${a.grade}`).join(' → ')} → {isTh ? 'กำลังเรียน' : 'Enrolled'}
                          </p>
                        </div>
                        <span className="text-xs font-mono text-[#D4D4D4] shrink-0">{c.credits} {isTh ? 'นก.' : 'cr'}</span>
                      </div>
                    ))}

                    {summary.withdrawnCourses.map((c) => (
                      <div
                        key={c.courseCode}
                        className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-[#9D9D9D] font-semibold">{c.courseCode}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#252526] border border-[#3C3C3C] text-[#9D9D9D]">
                              {isTh ? 'ถอน (W)' : 'Withdrawn'}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-[#FFFFFF] truncate mt-0.5">{c.courseName}</p>
                        </div>
                        <span className="text-xs font-mono text-[#9D9D9D] shrink-0">{c.credits} {isTh ? 'นก.' : 'cr'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Breakdown Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#FFFFFF]">
                    {isTh ? 'หน่วยกิตแยกตามหมวดหลักสูตร (คลิกเพื่อดู/ย้ายหมวดวิชา)' : 'Credits by Curriculum Category (Click to inspect/reassign)'}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {gradProgress.categoryProgress.map((cat) => {
                    const isExpanded = Boolean(expandedCategories[cat.id]);
                    const catCourses = [...cat.passedCourses, ...cat.inProgressCourses];
                    return (
                      <div
                        key={cat.id}
                        className="bg-[#252526] border border-[#3C3C3C] rounded-2xl overflow-hidden flex flex-col"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCategories((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
                          }
                          className="p-4 text-left hover:bg-[#2A2D2E] transition-colors cursor-pointer space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color || '#3794FF' }}
                              />
                              <span className="text-xs font-semibold text-[#FFFFFF] truncate">
                                {isTh ? cat.nameTh : cat.nameEn}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-mono font-semibold text-[#D4D4D4]">
                                {cat.passedCredits}
                                {cat.inProgressCredits > 0 && (
                                  <span className="text-[#3794FF]">+{cat.inProgressCredits}</span>
                                )}
                                <span className="text-[#858585]"> / {cat.requiredCredits}</span>
                              </span>
                              {isExpanded ? (
                                <ChevronUp size={15} className="text-[#858585]" />
                              ) : (
                                <ChevronDown size={15} className="text-[#858585]" />
                              )}
                            </div>
                          </div>

                          <div className="h-2 w-full bg-[#1E1E1E] rounded-full overflow-hidden relative">
                            <div
                              className="h-full opacity-40 absolute left-0 top-0 transition-all"
                              style={{ width: `${cat.projectedPct}%`, backgroundColor: cat.color || '#3794FF' }}
                            />
                            <div
                              className="h-full absolute left-0 top-0 transition-all"
                              style={{ width: `${cat.passedPct}%`, backgroundColor: cat.color || '#3794FF' }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#858585]">
                              {cat.passedCourses.length} {isTh ? 'วิชาผ่านแล้ว' : 'passed'}
                              {cat.inProgressCourses.length > 0 &&
                                ` • ${cat.inProgressCourses.length} ${isTh ? 'กำลังเรียน' : 'enrolled'}`}
                            </span>
                            {cat.isComplete ? (
                              <span className="text-emerald-400 font-medium flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                {isTh ? 'ครบเกณฑ์แล้ว' : 'Completed'}
                              </span>
                            ) : (
                              <span className="text-[#9D9D9D]">
                                {isTh ? `ขาดอีก ${cat.remainingCredits} นก.` : `${cat.remainingCredits} cr left`}
                              </span>
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-[#3C3C3C] bg-[#1E1E1E]/70 p-3 space-y-1.5">
                            {catCourses.length === 0 ? (
                              <p className="text-[11px] text-[#858585] text-center py-3">
                                {isTh ? 'ยังไม่มีรายวิชาในหมวดนี้' : 'No courses assigned to this category yet'}
                              </p>
                            ) : (
                              catCourses.map((course) => (
                                <div
                                  key={course.courseCode}
                                  className="flex items-center justify-between gap-2 bg-[#252526] border border-[#3C3C3C] rounded-lg px-2.5 py-1.5 text-[11px]"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-[#9D9D9D]">{course.courseCode}</span>
                                      {course.isPassed ? (
                                        <span className={`px-1.5 py-0.25 rounded border font-semibold ${getGradeBadgeClass(course.bestPassedGrade)} ${blurCls}`}>
                                          {course.bestPassedGrade}
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.25 rounded bg-[#007ACC]/20 text-[#3794FF] border border-[#007ACC]/40">
                                          {isTh ? 'กำลังเรียน' : 'Enrolled'}
                                        </span>
                                      )}
                                      <span className="text-[#858585] font-mono">{course.credits} {isTh ? 'นก.' : 'cr'}</span>
                                    </div>
                                    <p className="text-[#D4D4D4] truncate mt-0.5">
                                      {course.engName || course.courseName}
                                    </p>
                                  </div>
                                  <select
                                    aria-label={`Category for ${course.courseCode}`}
                                    value={gradProgress.resolvedCategoryByCode[course.courseCode] || cat.id}
                                    onChange={(e) => handleChangeCourseCategory(course.courseCode, e.target.value)}
                                    className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-md px-1.5 py-1 text-[10px] text-[#D4D4D4] max-w-[125px] cursor-pointer"
                                  >
                                    {gradProgress.categoryProgress.map((opt) => (
                                      <option key={opt.id} value={opt.id}>
                                        {isTh ? opt.nameTh : opt.nameEn}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* GPA Trend Chart */}
              <GpaTrendChart gradedSemesters={summary.gradedSemesters} blur={privacyBlur} isTh={isTh} />
            </div>
          )}

          {/* ══ TAB 2: SEMESTER GRADES ════════════════════════════════ */}
          {activeTab === 'grades' && (
            <div className="space-y-4">
              {/* Filter bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#252526] border border-[#3C3C3C] rounded-2xl p-3">
                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]" />
                  <input
                    type="text"
                    value={gradeSearch}
                    onChange={(e) => setGradeSearch(e.target.value)}
                    placeholder={isTh ? 'ค้นหารหัสวิชา หรือชื่อวิชา...' : 'Search by course code or name...'}
                    className="w-full pl-9 pr-3 py-2 bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl text-xs text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'all', th: 'ทั้งหมด', en: 'All' },
                    { id: 'high', th: 'A / B+ / B', en: 'A / B+ / B' },
                    { id: 'pass', th: 'C+ / C / D+ / D', en: 'C+ – D' },
                    { id: 'fail', th: 'F / W', en: 'F / W' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setGradeFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        gradeFilter === f.id
                          ? 'bg-[#007ACC] text-white border-[#007ACC]'
                          : 'bg-[#1E1E1E] text-[#9D9D9D] border-[#3C3C3C] hover:text-[#FFFFFF]'
                      }`}
                    >
                      {isTh ? f.th : f.en}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewestFirst((prev) => !prev)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1E1E1E] text-[#D4D4D4] border border-[#3C3C3C] hover:border-[#007ACC] cursor-pointer"
                  >
                    {newestFirst ? (isTh ? 'ใหม่ → เก่า' : 'Newest') : (isTh ? 'เก่า → ใหม่' : 'Oldest')}
                  </button>
                </div>
              </div>

              {displaySemesters.length === 0 ? (
                <div className="bg-[#252526] border border-[#3C3C3C] border-dashed rounded-2xl p-10 text-center text-xs text-[#9D9D9D]">
                  {isTh ? 'ไม่พบรายวิชาที่ตรงกับเงื่อนไขการค้นหา' : 'No matching semester courses found.'}
                </div>
              ) : (
                displaySemesters.map((sem) => {
                  const isInProgressEmpty =
                    sem.courses.length === 0 && (academicData?.enrolledCourses?.length || 0) > 0;
                  return (
                    <div
                      key={sem.semesterId}
                      className="bg-[#252526] border border-[#3C3C3C] rounded-2xl overflow-hidden"
                    >
                      <div className="px-5 py-3.5 border-b border-[#3C3C3C] bg-[#2D2D2D] flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-sm font-semibold text-[#FFFFFF]">
                            {isTh ? `ภาคการศึกษา ${sem.semesterId}` : `Semester ${sem.semesterId}`}
                          </h3>
                          {sem.status && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#1E1E1E] border border-[#3C3C3C] text-[#9D9D9D]">
                              {sem.status}
                            </span>
                          )}
                        </div>
                        <div className={`flex items-center gap-3 text-xs font-mono ${blurCls}`}>
                          {sem.computedStats.cg > 0 && (
                            <span className="text-[#3794FF] font-semibold">
                              GPA {formatGpa(sem.computedStats.gpa)}
                            </span>
                          )}
                          <span className="text-emerald-400 font-semibold">
                            GPAX {formatGpa(sem.computedCumulative.gpax)}
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-[#3C3C3C] text-[11px] text-[#858585] bg-[#1E1E1E]/60">
                              <th className="px-4 py-2.5 font-medium">{isTh ? 'รหัสวิชา' : 'Code'}</th>
                              <th className="px-4 py-2.5 font-medium">{isTh ? 'ชื่อรายวิชา' : 'Course Name'}</th>
                              <th className="px-3 py-2.5 font-medium text-center">{isTh ? 'ตอน' : 'Sec'}</th>
                              <th className="px-3 py-2.5 font-medium text-center">{isTh ? 'หน่วยกิต' : 'Cr'}</th>
                              <th className="px-4 py-2.5 font-medium text-right">{isTh ? 'เกรด' : 'Grade'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#3C3C3C]/60">
                            {sem.filteredCourses.map((c, idx) => (
                              <tr key={`${c.courseCode}-${idx}`} className="hover:bg-[#2A2D2E]/60">
                                <td className="px-4 py-2.5 font-mono text-[#9D9D9D]">{c.courseCode}</td>
                                <td className="px-4 py-2.5 text-[#FFFFFF] font-medium">{c.courseName}</td>
                                <td className="px-3 py-2.5 text-center text-[#9D9D9D]">{c.section || '-'}</td>
                                <td className="px-3 py-2.5 text-center font-mono text-[#D4D4D4]">{c.credits}</td>
                                <td className="px-4 py-2.5 text-right">
                                  <span
                                    className={`inline-block min-w-[2.2rem] text-center px-2 py-0.5 rounded-md border font-semibold font-mono ${getGradeBadgeClass(
                                      c.grade
                                    )} ${blurCls}`}
                                  >
                                    {c.grade || '-'}
                                  </span>
                                </td>
                              </tr>
                            ))}

                            {isInProgressEmpty &&
                              academicData.enrolledCourses.map((ec) => (
                                <tr key={`enrolled-${ec.courseCode}`} className="hover:bg-[#2A2D2E]/60">
                                  <td className="px-4 py-2.5 font-mono text-[#9D9D9D]">{ec.courseCode}</td>
                                  <td className="px-4 py-2.5 text-[#FFFFFF] font-medium">
                                    {ec.engName || ec.thaiName}
                                    {ec.thaiName && ec.engName && (
                                      <span className="block text-[11px] text-[#858585] font-normal">{ec.thaiName}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-[#9D9D9D]">
                                    {(ec.sections || []).join(', ') || '-'}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono text-[#D4D4D4]">{ec.credits}</td>
                                  <td className="px-4 py-2.5 text-right">
                                    <span className="inline-block px-2 py-0.5 rounded-md border bg-[#007ACC]/20 text-[#3794FF] border-[#007ACC]/40 text-[11px] font-medium">
                                      {isTh ? 'กำลังเรียน' : 'In Progress'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="px-5 py-2.5 border-t border-[#3C3C3C] bg-[#1E1E1E] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#858585] font-mono">
                        <span>
                          {isTh ? 'ภาคนี้:' : 'Term:'} CA {sem.computedStats.ca} • CS {sem.computedStats.cs} • CG{' '}
                          {sem.computedStats.cg} •{' '}
                          <span className={blurCls}>GP {sem.computedStats.gp}</span>
                        </span>
                        <span>
                          {isTh ? 'สะสม:' : 'Cum:'} CA {sem.computedCumulative.ca} • CS {sem.computedCumulative.cs} • CG{' '}
                          {sem.computedCumulative.cg}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ══ TAB 3: PASSED COURSES AUDIT ═══════════════════════════ */}
          {activeTab === 'passed' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#252526] border border-[#3C3C3C] rounded-2xl p-3">
                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]" />
                  <input
                    type="text"
                    value={gradeSearch}
                    onChange={(e) => setGradeSearch(e.target.value)}
                    placeholder={isTh ? 'ค้นหารายวิชา...' : 'Search courses...'}
                    className="w-full pl-9 pr-3 py-2 bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl text-xs text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', th: `ทั้งหมด (${summary.allCourseAudits.length})`, en: `All (${summary.allCourseAudits.length})` },
                    { id: 'passed', th: `ผ่านแล้ว (${summary.passedCourses.length})`, en: `Passed (${summary.passedCourses.length})` },
                    { id: 'in_progress', th: `กำลังเรียน (${summary.inProgressCourses.length})`, en: `Enrolled (${summary.inProgressCourses.length})` },
                    { id: 'failed', th: `ไม่ผ่าน/ถอน (${summary.failedCourses.length + summary.withdrawnCourses.length})`, en: `Failed/W (${summary.failedCourses.length + summary.withdrawnCourses.length})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAuditFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        auditFilter === f.id
                          ? 'bg-[#007ACC] text-white border-[#007ACC]'
                          : 'bg-[#1E1E1E] text-[#9D9D9D] border-[#3C3C3C] hover:text-[#FFFFFF]'
                      }`}
                    >
                      {isTh ? f.th : f.en}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#3C3C3C] text-[11px] text-[#858585] bg-[#2D2D2D]">
                        <th className="px-4 py-3 font-medium">{isTh ? 'รหัสวิชา' : 'Code'}</th>
                        <th className="px-4 py-3 font-medium">{isTh ? 'รายวิชา & ประวัติการลง' : 'Course & Attempts'}</th>
                        <th className="px-3 py-3 font-medium text-center">{isTh ? 'นก.' : 'Cr'}</th>
                        <th className="px-3 py-3 font-medium text-center">{isTh ? 'สถานะ' : 'Status'}</th>
                        <th className="px-4 py-3 font-medium text-right">{isTh ? 'หมวดเกณฑ์จบ' : 'Category'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3C3C3C]/60">
                      {filteredAuditCourses.map((c) => (
                        <tr key={c.courseCode} className="hover:bg-[#2A2D2E]/50">
                          <td className="px-4 py-3 font-mono text-[#9D9D9D] align-top">{c.courseCode}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#FFFFFF]">{c.engName || c.courseName}</p>
                            {c.thaiName && c.engName && (
                              <p className="text-[11px] text-[#858585]">{c.thaiName}</p>
                            )}
                            {c.attempts.length > 0 && (
                              <p className={`text-[11px] text-[#9D9D9D] mt-0.5 ${blurCls}`}>
                                {c.attempts.map((a) => `${a.semesterId}: ${a.grade || '-'}`).join(' → ')}
                                {c.isCurrentlyEnrolled && !c.isPassed ? (isTh ? ' → กำลังเรียน' : ' → Enrolled') : ''}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-[#D4D4D4]">{c.credits}</td>
                          <td className="px-3 py-3 text-center">
                            {c.status === 'passed' && (
                              <span className={`inline-block px-2 py-0.5 rounded-md border font-semibold font-mono ${getGradeBadgeClass(c.bestPassedGrade)} ${blurCls}`}>
                                {c.bestPassedGrade}
                              </span>
                            )}
                            {c.status === 'retaking' && (
                              <span className="inline-block px-2 py-0.5 rounded-md border bg-[#007ACC]/20 text-[#3794FF] border-[#007ACC]/40 text-[11px]">
                                {isTh ? 'รีเกรด' : 'Retaking'}
                              </span>
                            )}
                            {c.status === 'in_progress' && (
                              <span className="inline-block px-2 py-0.5 rounded-md border bg-[#007ACC]/15 text-[#3794FF] border-[#007ACC]/30 text-[11px]">
                                {isTh ? 'กำลังเรียน' : 'Enrolled'}
                              </span>
                            )}
                            {c.status === 'failed' && (
                              <span className="inline-block px-2 py-0.5 rounded-md border bg-rose-500/15 text-rose-400 border-rose-500/30 font-semibold font-mono">
                                F
                              </span>
                            )}
                            {c.status === 'withdrawn' && (
                              <span className="inline-block px-2 py-0.5 rounded-md border bg-[#1E1E1E] text-[#9D9D9D] border-[#3C3C3C] font-mono">
                                W
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <select
                              aria-label={`Audit category for ${c.courseCode}`}
                              value={gradProgress.resolvedCategoryByCode[c.courseCode] || ''}
                              onChange={(e) => handleChangeCourseCategory(c.courseCode, e.target.value)}
                              className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-lg px-2 py-1 text-[11px] text-[#D4D4D4] max-w-[170px] cursor-pointer"
                            >
                              {gradProgress.categoryProgress.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {isTh ? opt.nameTh : opt.nameEn}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB 4: WHAT-IF GPA SIMULATOR ══════════════════════════ */}
          {activeTab === 'simulator' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Course Grade Picker */}
              <div className="lg:col-span-2 bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#FFFFFF]">
                      {isTh ? 'จำลองเกรดเทอมนี้ (What-if Simulator)' : 'What-if Term Grade Simulator'}
                    </h3>
                    <p className="text-[11px] text-[#9D9D9D]">
                      {isTh
                        ? 'ลองปรับเกรดของแต่ละวิชาเพื่อดูว่า GPA เทอมนี้และ GPAX สะสมจะขยับไปเท่าไหร่'
                        : 'Adjust expected grades for each course to preview your next Term GPA and GPAX.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(academicData?.enrolledCourses?.length || 0) > 0 && (
                      <button
                        type="button"
                        onClick={handleReloadEnrolledIntoSim}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-[#1E1E1E] border border-[#3C3C3C] text-[#D4D4D4] hover:border-[#007ACC] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={12} />
                        <span>{isTh ? 'ดึงวิชาเทอมนี้' : 'Load Term'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSimCourses((prev) => prev.map((c) => ({ ...c, grade: 'B' })))}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-[#1E1E1E] border border-[#3C3C3C] text-[#D4D4D4] hover:border-[#007ACC] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      <span>{isTh ? 'ตั้งเป็น B' : 'Set all B'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddSimCourse}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#007ACC] hover:bg-[#1177BB] text-white font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>{isTh ? 'เพิ่มวิชา' : 'Add Course'}</span>
                    </button>
                  </div>
                </div>

                {simCourses.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-[#3C3C3C] rounded-xl text-xs text-[#9D9D9D] space-y-2">
                    <p>
                      {isTh
                        ? 'ยังไม่มีรายวิชาจำลอง — นำเข้าหน้าตารางเรียน/สอบ หรือกด "+ เพิ่มวิชา" ด้านบนได้เลย'
                        : 'No simulated courses yet — import your Timetable or click "+ Add Course".'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {simCourses.map((sc, idx) => (
                      <div
                        key={sc.id}
                        className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-3"
                      >
                        <div className="flex-1 min-w-[160px]">
                          <div className="flex items-center gap-1.5">
                            {sc.courseCode && (
                              <span className="text-[11px] font-mono text-[#858585]">{sc.courseCode}</span>
                            )}
                            {sc.isRetake && (
                              <span className="text-[10px] px-1.5 py-0.25 rounded bg-[#007ACC]/20 text-[#3794FF]">
                                {isTh ? 'รีเกรด' : 'Retake'}
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={sc.courseName}
                            onChange={(e) =>
                              setSimCourses((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, courseName: e.target.value } : item))
                              )
                            }
                            aria-label="Simulated course name"
                            className="w-full bg-transparent text-xs font-medium text-[#FFFFFF] focus:outline-none border-b border-transparent focus:border-[#007ACC] mt-0.5"
                          />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="1"
                            max="9"
                            value={sc.credits}
                            onChange={(e) =>
                              setSimCourses((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, credits: Math.max(0, parseInt(e.target.value, 10) || 0) } : item
                                )
                              )
                            }
                            aria-label="Simulated course credits"
                            className="w-12 bg-[#252526] border border-[#3C3C3C] rounded-lg px-2 py-1.5 text-xs text-center text-[#FFFFFF] font-mono"
                          />
                          <span className="text-[11px] text-[#858585]">{isTh ? 'นก.' : 'cr'}</span>

                          <select
                            value={sc.grade}
                            onChange={(e) =>
                              setSimCourses((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, grade: e.target.value } : item))
                              )
                            }
                            aria-label={`Expected grade for ${sc.courseName}`}
                            className="bg-[#252526] border border-[#3C3C3C] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#FFFFFF] font-mono cursor-pointer"
                          >
                            {SIMULATOR_GRADE_OPTIONS.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => setSimCourses((prev) => prev.filter((_, i) => i !== idx))}
                            aria-label="Remove simulated course"
                            className="p-1.5 rounded-lg text-[#858585] hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Projected Output & Target GPAX Solver */}
              <div className="space-y-4">
                <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-[#FFFFFF]">
                    {isTh ? 'ผลลัพธ์จำลอง' : 'Projected Result'}
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-3">
                      <span className="text-[11px] text-[#9D9D9D] block">{isTh ? 'GPA เทอมนี้' : 'Term GPA'}</span>
                      <span className={`text-2xl font-bold font-mono text-[#3794FF] mt-1 block ${blurCls}`}>
                        {formatGpa(simResult.termGpa)}
                      </span>
                      <span className="text-[10px] text-[#858585] font-mono">CG {simResult.termCG}</span>
                    </div>

                    <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-3">
                      <span className="text-[11px] text-[#9D9D9D] block">{isTh ? 'GPAX ใหม่' : 'New GPAX'}</span>
                      <span className={`text-2xl font-bold font-mono text-emerald-400 mt-1 block ${blurCls}`}>
                        {formatGpa(simResult.projectedGpax)}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-semibold ${
                          simResult.gpaxDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        } ${blurCls}`}
                      >
                        {simResult.gpaxDelta >= 0 ? `+${simResult.gpaxDelta.toFixed(2)}` : simResult.gpaxDelta.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-3 text-xs flex items-center justify-between">
                    <span className="text-[#9D9D9D]">{isTh ? 'หน่วยกิตผ่านสะสมใหม่' : 'New Passed Credits'}</span>
                    <span className="font-mono font-semibold text-[#FFFFFF]">
                      {simResult.projectedPassedCredits} / {gradProgress.totalRequired} {isTh ? 'นก.' : 'cr'}
                    </span>
                  </div>
                </div>

                {/* Target GPAX Solver */}
                <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5 space-y-3.5">
                  <h3 className="text-sm font-semibold text-[#FFFFFF]">
                    {isTh ? 'คำนวณเกรดที่ต้องทำเพื่อให้ถึงเป้า' : 'Target GPAX Calculator'}
                  </h3>

                  <div className="flex items-center gap-2">
                    <label htmlFor="target-gpax-input" className="text-xs text-[#9D9D9D] shrink-0">
                      {isTh ? 'เป้าหมาย GPAX:' : 'Target GPAX:'}
                    </label>
                    <input
                      id="target-gpax-input"
                      type="number"
                      step="0.05"
                      min="1.50"
                      max="4.00"
                      value={targetGpax}
                      onChange={(e) => setTargetGpax(e.target.value)}
                      className="w-24 bg-[#1E1E1E] border border-[#3C3C3C] rounded-lg px-2.5 py-1.5 text-xs text-right font-mono text-[#FFFFFF]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {['2.00', '2.50', '2.75', '3.00', '3.25'].map((presetVal) => (
                      <button
                        key={presetVal}
                        type="button"
                        onClick={() => setTargetGpax(presetVal)}
                        className={`text-[11px] font-mono px-2.5 py-1 rounded-md border cursor-pointer ${
                          targetGpax === presetVal
                            ? 'bg-[#007ACC] text-white border-[#007ACC]'
                            : 'bg-[#1E1E1E] text-[#9D9D9D] border-[#3C3C3C] hover:text-[#FFFFFF]'
                        }`}
                      >
                        {presetVal}
                      </button>
                    ))}
                  </div>

                  {targetSolver.valid && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                        targetSolver.alreadyMet
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : targetSolver.achievable
                            ? 'bg-[#007ACC]/15 border-[#007ACC]/40 text-[#D4D4D4]'
                            : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {targetSolver.alreadyMet ? (
                        <span>
                          {isTh ? `คุณมี GPAX ถึงเป้า ${targetGpax} แล้ว!` : `You already meet target GPAX ${targetGpax}!`}
                        </span>
                      ) : targetSolver.achievable ? (
                        <span>
                          {isTh
                            ? `จาก ${plannedSimCredits || 18} หน่วยกิตเทอมนี้ ต้องทำเกรดเฉลี่ยอย่างน้อย `
                            : `Across ${plannedSimCredits || 18} credits this term, you need at least `}
                          <strong className={`text-[#FFFFFF] font-mono text-sm ${blurCls}`}>
                            {targetSolver.requiredGpa.toFixed(2)}
                          </strong>
                          {isTh ? ` เพื่อให้ GPAX ถึง ${targetGpax}` : ` to reach ${targetGpax}`}
                        </span>
                      ) : (
                        <span>
                          {isTh
                            ? `ต้องได้ GPA สูงกว่า 4.00 (${targetSolver.requiredGpa.toFixed(2)}) — ต้องค่อยๆ ดึงขึ้นมากกว่า 1 เทอมครับ`
                            : `Requires > 4.00 (${targetSolver.requiredGpa.toFixed(2)}) — will take more than one semester.`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Import Modal */}
      {isImportOpen && (
        <RegImportModal
          isOpen={isImportOpen}
          initialText={bookmarkletInitialText}
          defaultFocus="academic"
          lang={lang}
          onClose={() => {
            setIsImportOpen(false);
            setBookmarkletInitialText('');
          }}
          onImported={(parsed) => {
            const parts = [];
            if (parsed.meta.totalScheduleSlots > 0) {
              parts.push(isTh ? `ตารางเรียน ${parsed.meta.totalScheduleSlots} คาบ` : `${parsed.meta.totalScheduleSlots} classes`);
            }
            if (parsed.meta.totalExams > 0) {
              parts.push(isTh ? `วันสอบ ${parsed.meta.totalExams} รายการ` : `${parsed.meta.totalExams} exams`);
            }
            if (parsed.meta.hasGrades) {
              parts.push(isTh ? `เกรด ${parsed.meta.totalSemesters} เทอม` : `${parsed.meta.totalSemesters} semesters`);
            }
            addToast(
              isTh ? `นำเข้าข้อมูลสำเร็จ: ${parts.join(', ')}` : `Imported: ${parts.join(', ')}`,
              'success'
            );
          }}
        />
      )}

      {/* Curriculum Criteria Modal */}
      {isCurriculumModalOpen && (
        <CurriculumEditorModal
          key={academicData?.updatedAt || 'curriculum-editor'}
          isOpen={isCurriculumModalOpen}
          curriculum={academicData?.curriculum}
          minGpax={academicData?.minGpax ?? 2.0}
          isTh={isTh}
          onSave={handleSaveCurriculum}
          onClose={() => setIsCurriculumModalOpen(false)}
        />
      )}
    </div>
  );
}
