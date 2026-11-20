/**
 * KMUTNB Academic Calculations, Curriculum Progress, Retake Resolution & What-If GPA Engine.
 * All calculations run 100% client-side.
 */

export const GRADE_POINTS = {
  A: 4.0,
  'B+': 3.5,
  B: 3.0,
  'C+': 2.5,
  C: 2.0,
  'D+': 1.5,
  D: 1.0,
  F: 0.0,
};

export const PASSING_GRADES = new Set(['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'S']);
export const FAILING_GRADES = new Set(['F', 'U', 'FA', 'FE']);
export const NON_CREDIT_GRADES = new Set(['W', 'I', 'IP', 'P', 'AUD', '']);
export const SIMULATOR_GRADE_OPTIONS = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'W', 'S'];

/**
 * KMUTNB Reg truncates GPA/GPAX to 2 decimal places (e.g. 25.5 / 18 = 1.4166 -> 1.41, 184.5 / 84 = 2.1964 -> 2.19).
 */
export function truncateTwoDecimals(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  // Add tiny epsilon to avoid floating point issues like 2.25 * 100 = 224.99999999999997
  return Math.floor(value * 100 + 1e-9) / 100;
}

export function formatGpa(value) {
  if (!Number.isFinite(value)) return '0.00';
  return truncateTwoDecimals(value).toFixed(2);
}

export function normalizeGrade(rawGrade) {
  if (!rawGrade || typeof rawGrade !== 'string') return '';
  return rawGrade.trim().toUpperCase().replace(/\s+/g, '');
}

export function isPassingGrade(grade) {
  return PASSING_GRADES.has(normalizeGrade(grade));
}

export function isFailingGrade(grade) {
  return FAILING_GRADES.has(normalizeGrade(grade));
}

export function isGpaCountedGrade(grade) {
  return Object.prototype.hasOwnProperty.call(GRADE_POINTS, normalizeGrade(grade));
}

/**
 * Default KMUTNB Bachelor's Curriculum Categories (editable by user).
 * Total default = 129 credits (standard 4-year B.Sc. / CS-like KMUTNB curriculum; presets available).
 */
export const DEFAULT_CURRICULUM_CATEGORIES = [
  {
    id: 'gened_lang',
    nameTh: 'ศึกษาทั่วไป — กลุ่มภาษา',
    nameEn: 'General Ed — Languages',
    requiredCredits: 12,
    color: '#3794FF',
  },
  {
    id: 'gened_other',
    nameTh: 'ศึกษาทั่วไป — สังคม/มนุษย์/วิทย์-พละ',
    nameEn: 'General Ed — Social / Humanities / Health',
    requiredCredits: 18,
    color: '#4EC9B0',
  },
  {
    id: 'major_core',
    nameTh: 'วิชาเฉพาะ — แกนวิทย์-คณิต & บังคับสาขา',
    nameEn: 'Major — Core & Required',
    requiredCredits: 72,
    color: '#C586C0',
  },
  {
    id: 'major_elective',
    nameTh: 'วิชาเฉพาะ — เลือกสาขา',
    nameEn: 'Major — Electives',
    requiredCredits: 21,
    color: '#CCA700',
  },
  {
    id: 'free_elective',
    nameTh: 'วิชาเลือกเสรี',
    nameEn: 'Free Electives',
    requiredCredits: 6,
    color: '#CE9178',
  },
];

export const CURRICULUM_PRESETS = [
  {
    id: 'kmutnb_sci_129',
    labelTh: 'วท.บ. มจพ. (129 นก.)',
    labelEn: 'KMUTNB B.Sc. (129 cr)',
    minGpax: 2.0,
    categories: DEFAULT_CURRICULUM_CATEGORIES,
  },
  {
    id: 'kmutnb_sci_126',
    labelTh: 'วท.บ. หลักสูตรปรับปรุง (126 นก.)',
    labelEn: 'KMUTNB B.Sc. Revised (126 cr)',
    minGpax: 2.0,
    categories: [
      { id: 'gened_lang', nameTh: 'ศึกษาทั่วไป — กลุ่มภาษา', nameEn: 'General Ed — Languages', requiredCredits: 12, color: '#3794FF' },
      { id: 'gened_other', nameTh: 'ศึกษาทั่วไป — สังคม/มนุษย์/วิทย์-พละ', nameEn: 'General Ed — Social / Humanities / Health', requiredCredits: 18, color: '#4EC9B0' },
      { id: 'major_core', nameTh: 'วิชาเฉพาะ — แกนวิทย์-คณิต & บังคับสาขา', nameEn: 'Major — Core & Required', requiredCredits: 69, color: '#C586C0' },
      { id: 'major_elective', nameTh: 'วิชาเฉพาะ — เลือกสาขา', nameEn: 'Major — Electives', requiredCredits: 21, color: '#CCA700' },
      { id: 'free_elective', nameTh: 'วิชาเลือกเสรี', nameEn: 'Free Electives', requiredCredits: 6, color: '#CE9178' },
    ],
  },
  {
    id: 'kmutnb_eng_138',
    labelTh: 'วศ.บ. วิศวกรรมศาสตร์ มจพ. (138 นก.)',
    labelEn: 'KMUTNB B.Eng. (138 cr)',
    minGpax: 2.0,
    categories: [
      { id: 'gened_lang', nameTh: 'ศึกษาทั่วไป — กลุ่มภาษา', nameEn: 'General Ed — Languages', requiredCredits: 12, color: '#3794FF' },
      { id: 'gened_other', nameTh: 'ศึกษาทั่วไป — สังคม/มนุษย์/วิทย์-พละ', nameEn: 'General Ed — Social / Humanities / Health', requiredCredits: 18, color: '#4EC9B0' },
      { id: 'major_core', nameTh: 'วิชาเฉพาะ — แกน & บังคับวิศวกรรม', nameEn: 'Major — Core & Required', requiredCredits: 87, color: '#C586C0' },
      { id: 'major_elective', nameTh: 'วิชาเฉพาะ — เลือกวิศวกรรม', nameEn: 'Major — Electives', requiredCredits: 15, color: '#CCA700' },
      { id: 'free_elective', nameTh: 'วิชาเลือกเสรี', nameEn: 'Free Electives', requiredCredits: 6, color: '#CE9178' },
    ],
  },
];

/**
 * KMUTNB building code decoder (Bangkok campus common buildings).
 */
export const KMUTNB_BUILDINGS = {
  '31': 'อาคาร 31 (ศูนย์ศิลปวัฒนธรรม / อเนกประสงค์)',
  '40': 'อาคาร 40 (อาคารอเนกประสงค์)',
  '42': 'อาคาร 42 (คณะครุศาสตร์อุตสาหกรรม)',
  '44': 'อาคาร 44 (คณะครุศาสตร์อุตสาหกรรม)',
  '46': 'อาคาร 46 (อาคารปฏิบัติการเทคโนโลยี)',
  '52': 'อาคาร 52 (วิทยาลัยเทคโนโลยีอุตสาหกรรม)',
  '62': 'อาคาร 62 (วิทยาลัยเทคโนโลยีอุตสาหกรรม)',
  '63': 'อาคาร 63 (วิทยาลัยเทคโนโลยีอุตสาหกรรม)',
  '64': 'อาคาร 64 (วิทยาลัยเทคโนโลยีอุตสาหกรรม)',
  '72': 'อาคาร 72 (อาคารสิรินธร)',
  '75': 'อาคาร 75 (อาคารคณะเทคโนโลยีสารสนเทศฯ / นวัตกรรม)',
  '78': 'อาคาร 78 (คณะวิทยาศาสตร์ประยุกต์)',
  '79': 'อาคาร 79 (คณะวิทยาศาสตร์ประยุกต์)',
  '81': 'อาคาร 81 (คณะวิศวกรรมศาสตร์)',
  '82': 'อาคาร 82 (คณะวิศวกรรมศาสตร์)',
  '84': 'อาคาร 84 (คณะวิศวกรรมศาสตร์)',
  '86': 'อาคาร 86 (คณะวิศวกรรมศาสตร์)',
  '88': 'อาคาร 88 (คณะวิศวกรรมศาสตร์)',
  '89': 'อาคาร 89 (คณะวิศวกรรมศาสตร์)',
  '90': 'อาคาร 90 (อาคารนวมินทรราชินี)',
};

export function decodeKmutnbBuilding(roomStr) {
  if (!roomStr || typeof roomStr !== 'string') return '';
  const cleaned = roomStr.trim();
  if (!cleaned || cleaned === '-') return '';
  const match = cleaned.match(/^[A-Za-z]?(\d{2})-/);
  if (!match) return '';
  return KMUTNB_BUILDINGS[match[1]] || `อาคาร ${match[1]}`;
}

/**
 * Infers the dominant 4-digit major department prefix from a list of courses (e.g. "0406" for CS).
 */
export function inferMajorDepartmentPrefix(courses = []) {
  const counts = {};
  for (const c of courses) {
    const code = String(c?.courseCode || '').trim();
    if (!/^\d{9}$/.test(code)) continue;
    const prefix4 = code.slice(0, 4);
    // Ignore GenEd prefixes (0801, 0802, 0803, 0309) and basic sci/math (0402, 0403, 0404, 0405)
    if (/^(0801|0802|0803|0309|0402|0403|0404|0405)/.test(prefix4)) continue;
    counts[prefix4] = (counts[prefix4] || 0) + 1;
  }
  let best = '';
  let max = 0;
  for (const [prefix, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      best = prefix;
    }
  }
  return best;
}

/**
 * Smartly assigns a default KMUTNB curriculum category based on 9-digit KMUTNB course code.
 */
export function inferCourseCategory(courseCode, dominantMajorPrefix = '', validCategoryIds = null) {
  const code = String(courseCode || '').trim();
  const hasCat = (id) => !validCategoryIds || validCategoryIds.has(id);

  let suggested = 'free_elective';

  if (/^0801/.test(code)) {
    suggested = 'gened_lang';
  } else if (/^(0802|0803|0309)/.test(code)) {
    suggested = 'gened_other';
  } else if (/^(0402|0403|0404|0405)/.test(code)) {
    suggested = 'major_core';
  } else if (dominantMajorPrefix && code.startsWith(dominantMajorPrefix)) {
    // Courses ending in 7xx / 8xx / 9xx in KMUTNB CS/Sci are frequently major electives (e.g. 040613708, 040613902)
    const last3 = parseInt(code.slice(6), 10);
    if (Number.isFinite(last3) && last3 >= 700) {
      suggested = 'major_elective';
    } else {
      suggested = 'major_core';
    }
  } else if (/^\d{9}$/.test(code)) {
    // Other faculty courses default to free_elective unless user moves them
    suggested = 'free_elective';
  }

  if (hasCat(suggested)) return suggested;
  if (validCategoryIds && validCategoryIds.size > 0) {
    return Array.from(validCategoryIds)[0];
  }
  return suggested;
}

/**
 * Compares two semester keys like "1/2567", "2/2567", "3/2567", "1/2568" chronologically.
 */
export function compareSemesterIds(a, b) {
  const parseSem = (s) => {
    const m = String(s || '').match(/(\d+)\s*\/\s*(\d{4})/);
    if (!m) return { year: 0, term: 0 };
    return { term: parseInt(m[1], 10), year: parseInt(m[2], 10) };
  };
  const pa = parseSem(a);
  const pb = parseSem(b);
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.term - pb.term;
}

/**
 * Computes GPA/credits statistics from a list of course rows for a single semester.
 */
export function computeSemesterStats(courses = []) {
  let ca = 0; // Credits attempted (excluding W? Actually KMUTNB CA excludes W in semester summary! Look at 2/2567: 5 graded + 1 W -> CA=15!)
  let cs = 0; // Credits earned / passed
  let cg = 0; // Credits graded (A..F)
  let gp = 0; // Grade points

  for (const c of courses) {
    const credits = Number(c?.credits) || 0;
    const grade = normalizeGrade(c?.grade);
    if (grade === 'W') continue; // Withdrawn courses do not count in KMUTNB CA/CG
    if (credits > 0) {
      ca += credits;
    }
    if (isPassingGrade(grade)) {
      cs += credits;
    }
    if (isGpaCountedGrade(grade)) {
      cg += credits;
      gp += credits * GRADE_POINTS[grade];
    }
  }

  const gpa = cg > 0 ? truncateTwoDecimals(gp / cg) : 0;
  return {
    ca,
    cs,
    cg,
    gp: Math.round(gp * 100) / 100,
    gpa,
  };
}

/**
 * Recalculates cumulative statistics across chronologically sorted semesters.
 * Uses official imported summary stats when present & valid, falling back to computed stats.
 */
export function computeAcademicSummary(semesters = [], enrolledCourses = []) {
  const sortedSemesters = [...(Array.isArray(semesters) ? semesters : [])].sort((a, b) =>
    compareSemesterIds(a.semesterId, b.semesterId)
  );

  let runningCA = 0;
  let runningCS = 0;
  let runningCG = 0;
  let runningGP = 0;

  const enrichedSemesters = sortedSemesters.map((sem) => {
    const computed = computeSemesterStats(sem.courses || []);
    const hasCourses = Array.isArray(sem.courses) && sem.courses.length > 0;

    // Prefer computed stats when courses are present; fall back to imported summary for in-progress terms (like 2/2569 with 0 graded rows)
    const semStats = hasCourses
      ? {
          ca: sem.semesterStats?.ca ?? computed.ca,
          cs: sem.semesterStats?.cs ?? computed.cs,
          cg: sem.semesterStats?.cg ?? computed.cg,
          gp: sem.semesterStats?.gp ?? computed.gp,
          gpa: sem.semesterStats?.gpa ?? computed.gpa,
        }
      : {
          ca: sem.semesterStats?.ca ?? 0,
          cs: sem.semesterStats?.cs ?? 0,
          cg: sem.semesterStats?.cg ?? 0,
          gp: sem.semesterStats?.gp ?? 0,
          gpa: sem.semesterStats?.gpa ?? 0,
        };

    runningCA += semStats.ca;
    runningCS += semStats.cs;
    runningCG += semStats.cg;
    runningGP = Math.round((runningGP + semStats.gp) * 100) / 100;

    const computedCumGpax = runningCG > 0 ? truncateTwoDecimals(runningGP / runningCG) : 0;
    const cumStats =
      sem.cumulativeStats && Number.isFinite(sem.cumulativeStats.gpax) && sem.cumulativeStats.cg > 0
        ? sem.cumulativeStats
        : {
            ca: runningCA,
            cs: runningCS,
            cg: runningCG,
            gp: runningGP,
            gpax: computedCumGpax,
          };

    return {
      ...sem,
      computedStats: semStats,
      computedCumulative: cumStats,
    };
  });

  // Deduplicate unique courses across all attempts + currently enrolled timetable courses
  const courseMap = new Map();
  const enrolledByCode = new Map();
  for (const ec of enrolledCourses || []) {
    if (!ec?.courseCode) continue;
    const code = String(ec.courseCode).trim();
    if (!enrolledByCode.has(code)) {
      enrolledByCode.set(code, ec);
    }
  }

  for (const sem of enrichedSemesters) {
    for (const row of sem.courses || []) {
      const code = String(row?.courseCode || '').trim();
      if (!code) continue;
      const grade = normalizeGrade(row.grade);
      const credits = Number(row.credits) || 0;

      if (!courseMap.has(code)) {
        courseMap.set(code, {
          courseCode: code,
          courseName: row.courseName || code,
          thaiName: row.thaiName || '',
          engName: row.engName || row.courseName || '',
          credits,
          attempts: [],
        });
      }
      const entry = courseMap.get(code);
      if (credits > 0) entry.credits = credits;
      if (row.courseName && (!entry.courseName || entry.courseName === code)) {
        entry.courseName = row.courseName;
      }
      entry.attempts.push({
        semesterId: sem.semesterId,
        grade,
        credits,
        section: row.section || '',
      });
    }
  }

  // Merge currently enrolled courses (from Timetable)
  for (const [code, ec] of enrolledByCode.entries()) {
    if (!courseMap.has(code)) {
      courseMap.set(code, {
        courseCode: code,
        courseName: ec.engName || ec.thaiName || code,
        thaiName: ec.thaiName || '',
        engName: ec.engName || '',
        credits: Number(ec.credits) || 0,
        attempts: [],
      });
    } else {
      const existing = courseMap.get(code);
      if (ec.thaiName && !existing.thaiName) existing.thaiName = ec.thaiName;
      if (ec.engName && !existing.engName) existing.engName = ec.engName;
      if (Number(ec.credits) > 0 && !existing.credits) existing.credits = Number(ec.credits);
    }
  }

  const allCourseAudits = [];
  for (const entry of courseMap.values()) {
    const passedAttempts = entry.attempts.filter((a) => isPassingGrade(a.grade));
    const failedOrWithdrawn = entry.attempts.filter((a) => isFailingGrade(a.grade) || a.grade === 'W');
    const isCurrentlyEnrolled = enrolledByCode.has(entry.courseCode);
    const latestAttempt = entry.attempts[entry.attempts.length - 1] || null;

    let status;
    let bestPassedGrade = '';
    if (passedAttempts.length > 0) {
      status = 'passed';
      // Pick latest passing grade
      bestPassedGrade = passedAttempts[passedAttempts.length - 1].grade;
    } else if (isCurrentlyEnrolled && failedOrWithdrawn.length > 0) {
      status = 'retaking';
    } else if (isCurrentlyEnrolled) {
      status = 'in_progress';
    } else if (latestAttempt && isFailingGrade(latestAttempt.grade)) {
      status = 'failed';
    } else if (latestAttempt && latestAttempt.grade === 'W') {
      status = 'withdrawn';
    } else {
      status = 'pending';
    }

    allCourseAudits.push({
      ...entry,
      status,
      isPassed: status === 'passed',
      isCurrentlyEnrolled,
      latestGrade: latestAttempt?.grade || '',
      bestPassedGrade,
      hasFailedHistory: entry.attempts.some((a) => isFailingGrade(a.grade)),
      hasWithdrawnHistory: entry.attempts.some((a) => a.grade === 'W'),
    });
  }

  const passedCourses = allCourseAudits.filter((c) => c.status === 'passed');
  const inProgressCourses = allCourseAudits.filter((c) => c.status === 'in_progress' || c.status === 'retaking');
  const failedCourses = allCourseAudits.filter((c) => c.status === 'failed');
  const withdrawnCourses = allCourseAudits.filter((c) => c.status === 'withdrawn');
  const retakingCourses = allCourseAudits.filter((c) => c.status === 'retaking');

  const uniquePassedCredits = passedCourses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
  const inProgressCredits = inProgressCourses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);

  // Latest graded semester for trend display
  const gradedSemesters = enrichedSemesters.filter((s) => (s.computedStats?.cg || 0) > 0);
  const latestGraded = gradedSemesters[gradedSemesters.length - 1] || null;
  const prevGraded = gradedSemesters.length >= 2 ? gradedSemesters[gradedSemesters.length - 2] : null;
  const latestOverall = enrichedSemesters[enrichedSemesters.length - 1] || null;

  const gpax = latestOverall?.computedCumulative?.gpax ?? (runningCG > 0 ? truncateTwoDecimals(runningGP / runningCG) : 0);
  const totalCG = latestOverall?.computedCumulative?.cg ?? runningCG;
  const totalGP = latestOverall?.computedCumulative?.gp ?? runningGP;
  const totalCA = latestOverall?.computedCumulative?.ca ?? runningCA;

  // Check honor eligibility (KMUTNB: no F/U/D/D+ or retake, 1st class >= 3.50, 2nd class >= 3.25)
  const hasDisqualifyingGradeForHonors = allCourseAudits.some((c) =>
    c.attempts.some((a) => ['F', 'U', 'D', 'D+'].includes(a.grade))
  );
  let standing = 'none';
  if (totalCG > 0) {
    if (gpax < 1.5) standing = 'dismissal_risk';
    else if (gpax < 2.0) standing = 'probation';
    else if (gpax >= 3.5 && !hasDisqualifyingGradeForHonors) standing = 'first_honors';
    else if (gpax >= 3.25 && !hasDisqualifyingGradeForHonors) standing = 'second_honors';
    else standing = 'normal';
  }

  return {
    semesters: enrichedSemesters,
    gradedSemesters,
    allCourseAudits,
    passedCourses,
    inProgressCourses,
    failedCourses,
    withdrawnCourses,
    retakingCourses,
    uniquePassedCredits,
    inProgressCredits,
    totalCA,
    totalCG,
    totalGP,
    gpax,
    latestGpa: latestGraded?.computedStats?.gpa ?? 0,
    latestSemesterId: latestGraded?.semesterId || '',
    gpaDelta: latestGraded && prevGraded
      ? Math.round((latestGraded.computedStats.gpa - prevGraded.computedStats.gpa) * 100) / 100
      : null,
    standing,
  };
}

/**
 * Maps all unique courses to curriculum categories and computes per-category & overall graduation progress.
 */
export function computeGraduationProgress(
  allCourseAudits = [],
  curriculumCategories = DEFAULT_CURRICULUM_CATEGORIES,
  courseCategoryMap = {},
  minGpax = 2.0,
  currentGpax = 0
) {
  const categories =
    Array.isArray(curriculumCategories) && curriculumCategories.length > 0
      ? curriculumCategories
      : DEFAULT_CURRICULUM_CATEGORIES;

  const validIds = new Set(categories.map((c) => c.id));
  const dominantMajor = inferMajorDepartmentPrefix(allCourseAudits);

  const buckets = new Map();
  categories.forEach((cat) => {
    buckets.set(cat.id, {
      ...cat,
      passedCourses: [],
      inProgressCourses: [],
      failedCourses: [],
      passedCredits: 0,
      inProgressCredits: 0,
    });
  });

  const resolvedCategoryByCode = {};

  for (const course of allCourseAudits) {
    const manualCat = courseCategoryMap?.[course.courseCode];
    const catId =
      manualCat && validIds.has(manualCat)
        ? manualCat
        : inferCourseCategory(course.courseCode, dominantMajor, validIds);

    resolvedCategoryByCode[course.courseCode] = catId;
    const bucket = buckets.get(catId);
    if (!bucket) continue;

    const cr = Number(course.credits) || 0;
    if (course.status === 'passed') {
      bucket.passedCourses.push(course);
      bucket.passedCredits += cr;
    } else if (course.status === 'in_progress' || course.status === 'retaking') {
      bucket.inProgressCourses.push(course);
      bucket.inProgressCredits += cr;
    } else if (course.status === 'failed' || course.status === 'withdrawn') {
      bucket.failedCourses.push(course);
    }
  }

  const categoryProgress = Array.from(buckets.values()).map((b) => {
    const required = Math.max(0, Number(b.requiredCredits) || 0);
    const remaining = Math.max(0, required - b.passedCredits);
    const remainingWithEnrolled = Math.max(0, required - (b.passedCredits + b.inProgressCredits));
    const passedPct = required > 0 ? Math.min(100, Math.round((b.passedCredits / required) * 100)) : 100;
    const projectedPct =
      required > 0 ? Math.min(100, Math.round(((b.passedCredits + b.inProgressCredits) / required) * 100)) : 100;

    return {
      ...b,
      requiredCredits: required,
      remainingCredits: remaining,
      remainingWithEnrolled,
      passedPct,
      projectedPct,
      isComplete: b.passedCredits >= required && required > 0,
    };
  });

  const totalRequired = categoryProgress.reduce((sum, c) => sum + c.requiredCredits, 0);
  const totalPassed = categoryProgress.reduce((sum, c) => sum + c.passedCredits, 0);
  const totalInProgress = categoryProgress.reduce((sum, c) => sum + c.inProgressCredits, 0);
  // Count capped credits toward graduation so overflow in one category doesn't mask shortfall in another
  const effectivePassed = categoryProgress.reduce(
    (sum, c) => sum + Math.min(c.passedCredits, c.requiredCredits),
    0
  );
  const allCategoriesMet = categoryProgress.every((c) => c.passedCredits >= c.requiredCredits);
  const hasUnresolvedFail = allCourseAudits.some((c) => c.status === 'failed');
  const gpaxMet = currentGpax >= minGpax;

  return {
    dominantMajor,
    resolvedCategoryByCode,
    categoryProgress,
    totalRequired,
    totalPassed,
    totalInProgress,
    effectivePassed,
    remainingCredits: Math.max(0, totalRequired - totalPassed),
    remainingWithEnrolled: Math.max(0, totalRequired - (totalPassed + totalInProgress)),
    overallPassedPct: totalRequired > 0 ? Math.min(100, Math.round((totalPassed / totalRequired) * 100)) : 0,
    overallProjectedPct:
      totalRequired > 0 ? Math.min(100, Math.round(((totalPassed + totalInProgress) / totalRequired) * 100)) : 0,
    checklist: {
      creditsMet: totalRequired > 0 && totalPassed >= totalRequired,
      allCategoriesMet: totalRequired > 0 && allCategoriesMet,
      gpaxMet,
      noUnresolvedFails: !hasUnresolvedFail,
    },
  };
}

/**
 * Simulates What-If GPA & GPAX given current cumulative GP/CG and hypothetical courses for the upcoming term.
 */
export function simulateWhatIfGpa(baseCG = 0, baseGP = 0, basePassedCredits = 0, simCourses = []) {
  let termCG = 0;
  let termGP = 0;
  let termPassedCredits = 0;

  for (const c of simCourses || []) {
    const credits = Number(c?.credits) || 0;
    const grade = normalizeGrade(c?.grade);
    if (credits <= 0 || !grade || grade === 'W') continue;
    if (isPassingGrade(grade)) {
      termPassedCredits += credits;
    }
    if (isGpaCountedGrade(grade)) {
      termCG += credits;
      termGP += credits * GRADE_POINTS[grade];
    }
  }

  const termGpa = termCG > 0 ? truncateTwoDecimals(termGP / termCG) : 0;
  const newCG = baseCG + termCG;
  const newGP = Math.round((baseGP + termGP) * 100) / 100;
  const currentGpax = baseCG > 0 ? truncateTwoDecimals(baseGP / baseCG) : 0;
  const projectedGpax = newCG > 0 ? truncateTwoDecimals(newGP / newCG) : 0;
  const gpaxDelta = Math.round((projectedGpax - currentGpax) * 100) / 100;

  return {
    termCG,
    termGP: Math.round(termGP * 100) / 100,
    termGpa,
    projectedCG: newCG,
    projectedGP: newGP,
    projectedGpax,
    gpaxDelta,
    projectedPassedCredits: basePassedCredits + termPassedCredits,
  };
}

/**
 * Calculates the minimum Term GPA needed over `plannedCredits` to reach `targetGpax`.
 */
export function solveRequiredTermGpa(baseCG = 0, baseGP = 0, plannedCredits = 0, targetGpax = 2.5) {
  const cr = Number(plannedCredits) || 0;
  const target = Number(targetGpax) || 0;
  if (cr <= 0 || target <= 0 || target > 4.0) {
    return { valid: false, requiredGpa: 0, achievable: false };
  }
  const totalCG = baseCG + cr;
  const requiredTotalGP = target * totalCG;
  const neededTermGP = requiredTotalGP - baseGP;
  const requiredGpa = neededTermGP / cr;

  return {
    valid: true,
    requiredGpa: Math.max(0, Math.ceil(requiredGpa * 100) / 100),
    achievable: requiredGpa <= 4.0,
    alreadyMet: requiredGpa <= 0,
  };
}
