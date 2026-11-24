/**
 * KMUTNB 13-digit Student ID decoder.
 *
 * Structure:  YY FF DD PP RRRRR (13 digits)
 *   YY    = entry year (last 2 digits of B.E.)   e.g. 67 -> 2567
 *   FF    = faculty code                          e.g. 04 -> Faculty of Applied Science
 *   DD    = department code within faculty        e.g. 06 -> Computer & Information Science
 *   PP    = program / curriculum code             e.g. 26 -> Computer Science (CS)
 *   RRRRR = running / group number                e.g. 11115
 *
 * Only applies to KMUTNB accounts; other universities are intentionally ignored.
 */

export const KMUTNB_CAMPUSES = {
  bkk: { th: 'มจพ. กรุงเทพฯ', en: 'KMUTNB Bangkok' },
  prachin: { th: 'มจพ. ปราจีนบุรี', en: 'KMUTNB Prachinburi' },
  rayong: { th: 'มจพ. ระยอง', en: 'KMUTNB Rayong' },
};

export const KMUTNB_FACULTIES = {
  '01': { th: 'คณะวิศวกรรมศาสตร์', en: 'Faculty of Engineering', short: 'ENG', campus: 'bkk' },
  '02': { th: 'คณะครุศาสตร์อุตสาหกรรม', en: 'Faculty of Technical Education', short: 'FTE', campus: 'bkk' },
  '03': { th: 'วิทยาลัยเทคโนโลยีอุตสาหกรรม', en: 'College of Industrial Technology', short: 'CIT', campus: 'bkk' },
  '04': { th: 'คณะวิทยาศาสตร์ประยุกต์', en: 'Faculty of Applied Science', short: 'SCI', campus: 'bkk' },
  '05': { th: 'คณะอุตสาหกรรมเกษตรดิจิทัล', en: 'Faculty of Digital Agro-Industry', short: 'AGRO', campus: 'bkk' },
  '06': { th: 'คณะเทคโนโลยีและการจัดการอุตสาหกรรม', en: 'Faculty of Industrial Technology and Management', short: 'FITM', campus: 'prachin' },
  '07': { th: 'คณะเทคโนโลยีสารสนเทศและนวัตกรรมดิจิทัล', en: 'Faculty of Information Technology and Digital Innovation', short: 'ITD', campus: 'bkk' },
  '08': { th: 'คณะศิลปศาสตร์ประยุกต์', en: 'Faculty of Applied Arts', short: 'ARTS', campus: 'bkk' },
  '09': { th: 'บัณฑิตวิทยาลัยวิศวกรรมศาสตร์นานาชาติสิรินธร ไทย-เยอรมัน', en: 'Sirindhorn International Thai-German Graduate School of Engineering', short: 'TGGS', campus: 'bkk' },
  '10': { th: 'บัณฑิตวิทยาลัย', en: 'Graduate College', short: 'GRAD', campus: 'bkk' },
  '11': { th: 'คณะสถาปัตยกรรมและการออกแบบ', en: 'Faculty of Architecture and Design', short: 'ARCH', campus: 'bkk' },
  '12': { th: 'คณะวิศวกรรมศาสตร์และเทคโนโลยี', en: 'Faculty of Engineering and Technology', short: 'FET', campus: 'rayong' },
  '13': { th: 'คณะวิทยาศาสตร์ พลังงานและสิ่งแวดล้อม', en: 'Faculty of Science, Energy and Environment', short: 'SEE', campus: 'rayong' },
  '14': { th: 'คณะบริหารธุรกิจ', en: 'Faculty of Business Administration', short: 'BA', campus: 'bkk' },
};

export const KMUTNB_DEPARTMENTS = {
  '01': {
    '00': { th: 'วิศวกรรมศาสตร์ทั่วไป', en: 'General Engineering', short: 'ENG' },
    '01': { th: 'วิศวกรรมเครื่องกลและอวกาศ', en: 'Mechanical and Aerospace Engineering', short: 'ME' },
    '02': { th: 'วิศวกรรมไฟฟ้าและคอมพิวเตอร์', en: 'Electrical and Computer Engineering', short: 'ECE' },
    '03': { th: 'วิศวกรรมการผลิตและหุ่นยนต์', en: 'Production and Robotics Engineering', short: 'PE' },
    '04': { th: 'วิศวกรรมเคมี', en: 'Chemical Engineering', short: 'ChE' },
    '05': { th: 'วิศวกรรมโยธา', en: 'Civil Engineering', short: 'CE' },
    '06': { th: 'วิศวกรรมอุตสาหการ', en: 'Industrial Engineering', short: 'IE' },
    '07': { th: 'วิศวกรรมวัสดุและเทคโนโลยีการผลิต', en: 'Materials and Production Technology Engineering', short: 'MPE' },
    '08': { th: 'วิศวกรรมเครื่องมือวัดและอิเล็กทรอนิกส์', en: 'Instrumentation and Electronics Engineering', short: 'IEE' },
    '09': { th: 'วิศวกรรมคอมพิวเตอร์', en: 'Computer Engineering', short: 'CPE' },
  },
  '02': {
    '01': { th: 'ครุศาสตร์เครื่องกล', en: 'Mechanical Technology Education', short: 'MTE' },
    '02': { th: 'ครุศาสตร์ไฟฟ้า', en: 'Electrical Technology Education', short: 'ETE' },
    '03': { th: 'ครุศาสตร์โยธา', en: 'Civil Technology Education', short: 'CTE' },
    '04': { th: 'คอมพิวเตอร์ศึกษา', en: 'Computer Education', short: 'CED' },
  },
  '03': {
    '01': { th: 'เทคโนโลยีวิศวกรรมเครื่องกล', en: 'Mechanical Engineering Technology', short: 'MET' },
    '02': { th: 'เทคโนโลยีวิศวกรรมไฟฟ้า', en: 'Electrical Engineering Technology', short: 'EET' },
    '03': { th: 'เทคโนโลยีวิศวกรรมโยธาและก่อสร้าง', en: 'Civil and Construction Engineering Technology', short: 'CET' },
    '04': { th: 'เทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์', en: 'Electronic Engineering Technology', short: 'EnET' },
  },
  '04': {
    '01': { th: 'ภาควิชาเคมีอุตสาหกรรม', en: 'Department of Industrial Chemistry', short: 'IC' },
    '02': { th: 'ภาควิชาคณิตศาสตร์', en: 'Department of Mathematics', short: 'MATH' },
    '03': { th: 'ภาควิชาฟิสิกส์อุตสาหกรรมและอุปกรณ์การแพทย์', en: 'Department of Industrial Physics and Medical Instrumentation', short: 'IMI' },
    '04': { th: 'ภาควิชาเทคโนโลยีชีวภาพ', en: 'Department of Biotechnology', short: 'BIOTECH' },
    '05': { th: 'ภาควิชาสถิติประยุกต์', en: 'Department of Applied Statistics', short: 'STAT' },
    '06': { th: 'ภาควิชาวิทยาการคอมพิวเตอร์และสารสนเทศ', en: 'Department of Computer and Information Science', short: 'CIS' },
    '07': { th: 'ภาควิชาเทคโนโลยีอุตสาหกรรมเกษตร', en: 'Department of Agro-Industrial Technology', short: 'AGRO' },
  },
  '06': {
    '01': { th: 'การจัดการอุตสาหกรรม', en: 'Industrial Management', short: 'IM' },
    '02': { th: 'เทคโนโลยีสารสนเทศ', en: 'Information Technology', short: 'IT' },
    '03': { th: 'วิศวกรรมเกษตร', en: 'Agricultural Engineering', short: 'AE' },
  },
  '07': {
    '01': { th: 'เทคโนโลยีสารสนเทศ', en: 'Information Technology', short: 'IT' },
    '02': { th: 'วิทยาการข้อมูลและนวัตกรรมดิจิทัล', en: 'Data Science and Digital Innovation', short: 'DSI' },
  },
  '08': {
    '01': { th: 'ภาษาและการสื่อสาร', en: 'Languages and Communication', short: 'LANG' },
    '02': { th: 'สังคมศาสตร์', en: 'Social Sciences', short: 'SOC' },
  },
  '11': {
    '01': { th: 'สถาปัตยกรรม', en: 'Architecture', short: 'ARCH' },
    '02': { th: 'สถาปัตยกรรมภายใน', en: 'Interior Architecture', short: 'IA' },
    '03': { th: 'การออกแบบ', en: 'Design', short: 'DESIGN' },
  },
  '14': {
    '01': { th: 'บริหารธุรกิจอุตสาหกรรม', en: 'Industrial Business Administration', short: 'IBA' },
    '02': { th: 'การบัญชี', en: 'Accounting', short: 'ACC' },
    '03': { th: 'โลจิสติกส์', en: 'Logistics', short: 'LOG' },
  },
};

export const KMUTNB_PROGRAMS = {
  '04-06-26': { th: 'วิทยาการคอมพิวเตอร์ (CS)', en: 'Computer Science (CS)', short: 'CS' },
};

export function isKmutnbEmail(email) {
  return /@(?:[a-z0-9-]+\.)*kmutnb\.ac\.th$/i.test(String(email || '').trim());
}

export function normalizeStudentId(raw) {
  return String(raw || '').replace(/[\s-]/g, '').trim();
}

export function extractStudentIdFromEmail(email) {
  return String(email || '').match(/\d{13}/)?.[0] || '';
}

/**
 * Computes a deterministic one-way FNV-1a hash of a 13-digit KMUTNB Student ID
 * matching extension/regContent.js (`ch_sid_<13digits>`) to verify account ownership
 * of extension snapshots without storing raw Student IDs in extension storage.
 */
export function hashStudentIdForBridge(rawId) {
  const clean = normalizeStudentId(rawId);
  if (!/^\d{13}$/.test(clean)) return '';
  const str = `ch_sid_${clean}`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/**
 * Current Thai academic year in B.E. (semester 1 starts around June).
 */
export function getCurrentAcademicYearBE(now = new Date()) {
  const beYear = now.getFullYear() + 543;
  return now.getMonth() >= 5 ? beYear : beYear - 1;
}

/**
 * Decodes a KMUTNB 13-digit student ID. Returns null for invalid IDs or unknown faculty codes.
 */
export function decodeKmutnbStudentId(rawId, { now = new Date() } = {}) {
  const id = normalizeStudentId(rawId);
  if (!/^\d{13}$/.test(id)) return null;

  const yearShort = id.slice(0, 2);
  const facultyCode = id.slice(2, 4);
  const departmentCode = id.slice(4, 6);
  const programCode = id.slice(6, 8);
  const faculty = KMUTNB_FACULTIES[facultyCode];
  if (!faculty) return null;

  const department = KMUTNB_DEPARTMENTS[facultyCode]?.[departmentCode] || null;
  const program = KMUTNB_PROGRAMS[`${facultyCode}-${departmentCode}-${programCode}`] || null;
  const campusLabel = KMUTNB_CAMPUSES[faculty.campus] || KMUTNB_CAMPUSES.bkk;
  const entryYearBE = 2500 + parseInt(yearShort, 10);
  const level = getCurrentAcademicYearBE(now) - entryYearBE + 1;
  const yearLevel = level >= 1 && level <= 8 ? level : null;

  const suggestedMajor = {
    th: program?.th || department?.th || '',
    en: program?.en || department?.en || '',
  };

  return {
    studentId: id,
    yearShort,
    entryYearBE,
    yearLevel,
    facultyCode,
    faculty,
    departmentCode,
    department,
    programCode,
    program,
    campusLabel,
    suggestedMajor,
    segments: [
      { key: 'year', value: yearShort },
      { key: 'faculty', value: facultyCode },
      { key: 'department', value: departmentCode },
      { key: 'program', value: programCode },
      { key: 'running', value: id.slice(8) },
    ],
  };
}
