import { parseExamDate } from '../../utils/examDate';
import { decodeKmutnbBuilding, normalizeGrade } from '../../utils/academicUtils';

const SCHEDULE_COLORS = [
  '#007ACC',
  '#4EC9B0',
  '#CCA700',
  '#C586C0',
  '#3794FF',
  '#CE9178',
  '#569CD6',
  '#2D9D78',
  '#F59E0B',
  '#EC4899',
];

const THAI_DAY_MAP = {
  'พฤ': 'thu',
  'พฤหัส': 'thu',
  'พฤหัสบดี': 'thu',
  'อา': 'sun',
  'อาทิตย์': 'sun',
  'จ': 'mon',
  'จันทร์': 'mon',
  'อ': 'tue',
  'อังคาร': 'tue',
  'พ': 'wed',
  'พุธ': 'wed',
  'ศ': 'fri',
  'ศุกร์': 'fri',
  'ส': 'sat',
  'เสาร์': 'sat',
  MO: 'mon',
  MON: 'mon',
  TU: 'tue',
  TUE: 'tue',
  WE: 'wed',
  WED: 'wed',
  TH: 'thu',
  THU: 'thu',
  FR: 'fri',
  FRI: 'fri',
  SA: 'sat',
  SAT: 'sat',
  SU: 'sun',
  SUN: 'sun',
};

const VALID_GRADES_REGEX = /^(?:A|B\+|B|C\+|C|D\+|D|F|W|S|U|I|P|IP|FA|FE|AUD|-)$/i;
const COURSE_CODE_LINE_REGEX = /^(\d{9})$/;
const CREDIT_SPEC_REGEX = /^(\d+(?:\.\d+)?)\s*\(\s*\d+\s*-\s*\d+\s*-\s*\d+\s*\)$/;
const CREDIT_SPEC_EMBEDDED_REGEX = /\b(\d+(?:\.\d+)?)\s*\(\s*\d+\s*-\s*\d+\s*-\s*\d+\s*\)/;
const STANDALONE_CREDIT_REGEX = /^(\d{1,2}(?:\.\d+)?)$/;

/**
 * Strictly parses course credits (0–12). Rejects room numbers like "78-621", "75-604", "31-1007B".
 */
function parseValidCredits(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const specMatch = s.match(CREDIT_SPEC_EMBEDDED_REGEX);
  if (specMatch) {
    const val = parseFloat(specMatch[1]);
    return Number.isFinite(val) && val >= 0 && val <= 12 ? val : null;
  }
  if (STANDALONE_CREDIT_REGEX.test(s)) {
    const val = parseFloat(s);
    return Number.isFinite(val) && val >= 0 && val <= 12 ? val : null;
  }
  return null;
}
const SECTION_TOKEN_REGEX = /^(?:[SL]\.?\d+|\d{1,3})$/i;
const SCHEDULE_SLOT_REGEX =
  /(พฤหัสบดี|พฤหัส|พฤ|อาทิตย์|อา|จันทร์|จ|อังคาร|อ|พุธ|พ|ศุกร์|ศ|เสาร์|ส|MON|MO|TUE|TU|WED|WE|THU|TH|FRI|FR|SAT|SA|SUN|SU)\.?\s*(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/gi;
const EXAM_DATETIME_REGEX =
  /(\d{1,2}\s+(?:ม\.?ค\.?|ก\.?พ\.?|มี\.?ค\.?|เม\.?ย\.?|พ\.?ค\.?|มิ\.?ย\.?|ก\.?ค\.?|ส\.?ค\.?|ก\.?ย\.?|ต\.?ค\.?|พ\.?ย\.?|ธ\.?ค\.?|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z.]*\s+\d{2,4})\s*(?:เวลา|Time)?\s*(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/i;

const FOOTER_OR_SECTION_BOUNDARY_REGEX =
  /^(?:@\s*\d{4}|©|Visionnet|ระบบสารสนเทศเพื่องานทะเบียน|หมายเหตุ\s*CA|ผลการศึกษา\s*$|\*\*ข้อมูลผลการเรียน|ปีการศึกษา\s*\d+\s*\/\s*\d{4})/i;

function padTime(h, m) {
  return `${String(parseInt(h, 10)).padStart(2, '0')}:${String(parseInt(m, 10)).padStart(2, '0')}`;
}

function toIsoDate(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Splits KMUTNB concatenated bilingual course title (e.g. "การโปรแกรมเชิงโครงสร้างStructured Programming")
 * into { thaiName, engName }.
 */
export function splitBilingualCourseTitle(rawTitle) {
  const cleaned = String(rawTitle || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { thaiName: '', engName: '' };

  const hasThai = /[\u0E00-\u0E7F]/.test(cleaned);
  const hasEng = /[A-Za-z]/.test(cleaned);

  if (!hasThai) return { thaiName: '', engName: cleaned };
  if (!hasEng) return { thaiName: cleaned, engName: '' };

  // Find transition where Thai characters end and pure-ASCII English title begins
  for (let i = 1; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (!/[A-Za-z]/.test(ch)) continue;
    const remainder = cleaned.slice(i);
    if (/[\u0E00-\u0E7F]/.test(remainder)) continue;

    // Walk back across spaces/punctuation to ensure preceding segment ends in Thai or closing paren/digit after Thai
    const before = cleaned.slice(0, i).trim();
    if (/[\u0E00-\u0E7F0-9)]$/.test(before)) {
      return {
        thaiName: before,
        engName: remainder.trim(),
      };
    }
  }

  return { thaiName: cleaned, engName: '' };
}

/**
 * Extracts all day + time slots from a KMUTNB schedule cell like "S.1 จ.08:30-10:30" or "L.2 พฤ.15:00-17:00".
 */
export function parseScheduleSlots(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return [];
  const slots = [];
  SCHEDULE_SLOT_REGEX.lastIndex = 0;
  let match;
  while ((match = SCHEDULE_SLOT_REGEX.exec(rawStr)) !== null) {
    const rawDay = match[1].toUpperCase();
    const day = THAI_DAY_MAP[match[1]] || THAI_DAY_MAP[rawDay];
    if (!day) continue;
    const startTime = padTime(match[2], match[3]);
    const endTime = padTime(match[4], match[5]);
    if (startTime < endTime) {
      slots.push({ day, startTime, endTime });
    }
  }
  return slots;
}

/**
 * Parses a KMUTNB exam date-time string like "15 ม.ค. 2570เวลา 09:00-12:00".
 */
export function parseExamDateTime(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return null;
  const match = rawStr.match(EXAM_DATETIME_REGEX);
  if (!match) return null;
  const dateText = match[1].replace(/\s+/g, ' ').trim();
  const startTime = padTime(match[2], match[3]);
  const endTime = padTime(match[4], match[5]);
  const parsedDate = parseExamDate(dateText);
  const rawIsoDate = toIsoDate(parsedDate);
  if (!rawIsoDate) return null;
  return {
    date: dateText,
    rawIsoDate,
    time: `${startTime}-${endTime}`,
    timestamp: parsedDate.getTime(),
  };
}

function normalizeRoom(rawRoom) {
  const cleaned = String(rawRoom || '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '—' || cleaned === 'ไม่มี') return '';
  return cleaned;
}

function isLikelyRoomLine(line) {
  if (!line) return false;
  const trimmed = line.trim();
  if (trimmed === '-' || trimmed === '—') return true;
  if (EXAM_DATETIME_REGEX.test(trimmed)) return false;
  if (FOOTER_OR_SECTION_BOUNDARY_REGEX.test(trimmed)) return false;
  // Common KMUTNB room formats: 78-621, 78-618/2, 31-1007B, B78-502, Online, TBA, LAB...
  if (/^[A-Za-z]?\d{2,3}-[\w/-]+$/i.test(trimmed)) return true;
  if (/^(?:online|tba|lab[\w\s-]*|สนาม[\u0E00-\u0E7F\s]*|อาคาร[\u0E00-\u0E7F\s0-9-]+)$/i.test(trimmed)) return true;
  if (trimmed.length <= 24 && /\d/.test(trimmed) && !/เวลา/.test(trimmed)) return true;
  return false;
}

function extractLinesFromHtml(htmlStr) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, 'text/html');
    // Remove scripts & styles
    doc.querySelectorAll('script, style, noscript').forEach((el) => el.remove());

    const tables = Array.from(doc.querySelectorAll('table'));
    const htmlTimetableRows = [];
    const htmlGradeSemesters = [];

    tables.forEach((table) => {
      const trs = Array.from(table.querySelectorAll('tr'));
      if (trs.length < 2) return;

      const headerCells = Array.from(trs[0].querySelectorAll('th, td')).map((c) =>
        c.textContent.replace(/\s+/g, ' ').trim()
      );
      const headerJoined = headerCells.join(' ');

      // Detect Timetable detail table
      if (
        headerJoined.includes('รหัสวิชา') &&
        (headerJoined.includes('วันเวลาเรียน') || headerJoined.includes('สอบกลางภาค') || headerJoined.includes('อาจารย์ผู้สอน'))
      ) {
        const colIdx = {
          code: headerCells.findIndex((h) => h.includes('รหัสวิชา')),
          section: headerCells.findIndex((h) => h.includes('ตอน')),
          title: headerCells.findIndex((h) => h.includes('รายวิชา') || h.includes('ชื่อวิชา')),
          credits: headerCells.findIndex((h) => h.includes('หน่วยกิต')),
          instructor: headerCells.findIndex((h) => h.includes('อาจารย์')),
          schedule: headerCells.findIndex((h) => h.includes('วันเวลาเรียน')),
          room: headerCells.findIndex((h) => h.includes('ห้อง')),
          midterm: headerCells.findIndex((h) => h.includes('สอบกลาง')),
          final: headerCells.findIndex((h) => h.includes('สอบปลาย')),
          remark: headerCells.findIndex((h) => h.includes('หมายเหตุ')),
        };

        trs.slice(1).forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll('td, th')).map((c) =>
            c.textContent.replace(/\s+/g, ' ').trim()
          );
          const code = colIdx.code >= 0 ? (cells[colIdx.code] || '') : '';
          if (!COURSE_CODE_LINE_REGEX.test(code)) return;

          const section = colIdx.section >= 0 ? (cells[colIdx.section] || '') : '';
          const rawTitle = colIdx.title >= 0 ? (cells[colIdx.title] || '') : '';
          const creditRaw = colIdx.credits >= 0 ? (cells[colIdx.credits] || '') : '';
          const parsedHtmlCr = parseValidCredits(creditRaw);
          const credits = parsedHtmlCr !== null ? parsedHtmlCr : 0;
          const instructor = colIdx.instructor >= 0 ? (cells[colIdx.instructor] || '') : '';
          const scheduleRaw = colIdx.schedule >= 0 ? (cells[colIdx.schedule] || '') : '';
          const room = colIdx.room >= 0 ? normalizeRoom(cells[colIdx.room]) : '';
          const midterm = colIdx.midterm >= 0 ? parseExamDateTime(cells[colIdx.midterm]) : null;
          const finalExam = colIdx.final >= 0 ? parseExamDateTime(cells[colIdx.final]) : null;
          const remark = colIdx.remark >= 0 ? (cells[colIdx.remark] || '') : '';

          const { thaiName, engName } = splitBilingualCourseTitle(rawTitle);
          htmlTimetableRows.push({
            courseCode: code,
            section,
            thaiName,
            engName,
            credits,
            creditSpec: creditRaw,
            instructor,
            slots: parseScheduleSlots(scheduleRaw),
            room,
            midterm,
            final: finalExam,
            remark,
          });
        });
      }

      // Detect Grade table
      if (
        headerJoined.includes('รหัสวิชา') &&
        headerJoined.includes('เกรด') &&
        !headerJoined.includes('วันเวลาเรียน')
      ) {
        const colIdx = {
          code: headerCells.findIndex((h) => h.includes('รหัสวิชา')),
          name: headerCells.findIndex((h) => h.includes('ชื่อวิชา') || h.includes('รายวิชา')),
          section: headerCells.findIndex((h) => h.includes('ตอน')),
          credits: headerCells.findIndex((h) => h.includes('หน่วยกิต')),
          grade: headerCells.findIndex((h) => h.includes('เกรด')),
        };

        // Find closest preceding semester heading in DOM
        let semesterId = '';
        let cursor = table.previousElementSibling;
        let hops = 0;
        while (cursor && hops < 6) {
          const m = cursor.textContent.match(/ปีการศึกษา\s*(\d+\s*\/\s*\d{4})/);
          if (m) {
            semesterId = m[1].replace(/\s+/g, '');
            break;
          }
          cursor = cursor.previousElementSibling;
          hops++;
        }
        if (!semesterId && table.parentElement) {
          const m = table.parentElement.textContent.match(/ปีการศึกษา\s*(\d+\s*\/\s*\d{4})/);
          if (m) semesterId = m[1].replace(/\s+/g, '');
        }

        const courses = [];
        trs.slice(1).forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll('td, th')).map((c) =>
            c.textContent.replace(/\s+/g, ' ').trim()
          );
          const code = colIdx.code >= 0 ? (cells[colIdx.code] || '') : '';
          if (!COURSE_CODE_LINE_REGEX.test(code)) return;
          courses.push({
            courseCode: code,
            courseName: colIdx.name >= 0 ? (cells[colIdx.name] || code) : code,
            section: colIdx.section >= 0 ? (cells[colIdx.section] || '') : '',
            credits: colIdx.credits >= 0 ? parseFloat(cells[colIdx.credits]) || 0 : 0,
            grade: colIdx.grade >= 0 ? normalizeGrade(cells[colIdx.grade]) : '',
          });
        });

        if (semesterId && courses.length > 0) {
          htmlGradeSemesters.push({
            semesterId,
            status: 'ปกติ',
            courses,
            semesterStats: null,
            cumulativeStats: null,
          });
        }
      }
    });

    // Also produce clean newline text fallback for modern div-based Visionnet layouts
    const clone = doc.body.cloneNode(true);
    clone.querySelectorAll('td, th, tr, div, p, li, h1, h2, h3, h4, h5, h6, br').forEach((el) => {
      el.appendChild(doc.createTextNode('\n'));
    });
    const textFallback = (clone.textContent || '').replace(/\r\n/g, '\n');

    return { htmlTimetableRows, htmlGradeSemesters, textFallback };
  } catch {
    return { htmlTimetableRows: [], htmlGradeSemesters: [], textFallback: htmlStr };
  }
}

const DATE_ONLY_LINE_REGEX =
  /^\d{1,2}\s+(?:ม\.?ค\.?|ก\.?พ\.?|มี\.?ค\.?|เม\.?ย\.?|พ\.?ค\.?|มิ\.?ย\.?|ก\.?ค\.?|ส\.?ค\.?|ก\.?ย\.?|ต\.?ค\.?|พ\.?ย\.?|ธ\.?ค\.?|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z.]*\s+\d{2,4}$/i;
const TIME_ONLY_LINE_REGEX =
  /^(?:เวลา|Time)?\s*\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}$/i;

/**
 * Parses timetable / enrollment rows from plain text pasted from reg.kmutnb.ac.th/registrar/timetable.
 * Supports single-line TSV, multi-line Chrome TSV (where <br>/<div> inside <td> splits rows across lines),
 * and line-per-cell browser copies.
 */
function parseTimetableFromText(text) {
  // Preserve \t characters for TSV parsing while removing empty lines and outer spaces
  const rawLines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/^ +| +$/g, ''))
    .filter((l) => l.trim().length > 0);
  const trimmedLines = rawLines.map((l) => l.trim());

  // Extract academic year hint (e.g. "ปีการศึกษา2569")
  let academicYear = '';
  for (const line of trimmedLines.slice(0, 60)) {
    const ym = line.match(/^ปีการศึกษา\s*(\d{4})$/);
    if (ym) {
      academicYear = ym[1];
      break;
    }
  }

  // Locate the detail table header ("รหัสวิชา" followed within 15 lines by "วันเวลาเรียน", "สอบกลาง", "อาจารย์", or "หน่วยกิต" without "เกรด")
  let startIdx = -1;
  let headerCols = null;
  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = trimmedLines[i];
    // Never treat caption lines like `หมายเหตุ : ข้อมูลที่แสดงคือ "รหัสวิชา (Sec.) ห้องเรียน"` as a table header!
    if (/^หมายเหตุ\s*[:：]/.test(trimmed)) continue;
    const firstHeaderCell = rawLines[i].split('\t')[0].trim();
    if (firstHeaderCell !== 'รหัสวิชา' && !/^รหัสวิชา(?:\s|$)/.test(trimmed)) continue;

    // Look ahead across up to 15 lines so wrapped multi-line <th> headers (e.g. "รหัสวิชา\tตอน\nเรียน\tรายวิชา...") still match
    let headerEnd = i + 1;
    while (
      headerEnd < rawLines.length &&
      headerEnd < i + 16 &&
      !COURSE_CODE_LINE_REGEX.test(rawLines[headerEnd].split('\t')[0].trim())
    ) {
      headerEnd++;
    }
    const headerRegionRaw = rawLines.slice(i, headerEnd);
    const lookahead = headerRegionRaw.map((l) => l.trim()).join(' ');
    const isTimetableHeader =
      lookahead.includes('วันเวลาเรียน') ||
      lookahead.includes('สอบกลาง') ||
      lookahead.includes('อาจารย์') ||
      (lookahead.includes('หน่วยกิต') && !lookahead.includes('เกรด'));

    if (isTimetableHeader) {
      const joinedHeader = headerRegionRaw.join(' ');
      if (joinedHeader.includes('\t')) {
        headerCols = joinedHeader.split('\t').map((h) => h.replace(/\s+/g, ' ').trim());
      }
      startIdx = headerEnd;
      break;
    }
  }

  // Headerless fallback: even if user didn't copy the table header row, find first 9-digit course code
  // whose nearby lines contain a schedule slot (e.g. "จ.08:30-10:30") or KMUTNB credit spec ("3(2-2-5)")
  if (startIdx === -1) {
    for (let i = 0; i < rawLines.length; i++) {
      const firstCell = rawLines[i].split('\t')[0].trim();
      if (!COURSE_CODE_LINE_REGEX.test(firstCell)) continue;
      const nearby = rawLines.slice(i, i + 12).join(' ');
      if (parseScheduleSlots(nearby).length > 0 || /\d+\(\d+-\d+-\d+\)/.test(nearby)) {
        startIdx = i;
        break;
      }
    }
  }

  if (startIdx === -1) {
    return { academicYear, rows: [] };
  }

  // Collect lines until hitting a non-timetable section boundary (e.g. Visionnet footer or Grade section)
  const tableLines = [];
  for (let i = startIdx; i < rawLines.length; i++) {
    if (FOOTER_OR_SECTION_BOUNDARY_REGEX.test(trimmedLines[i])) break;
    tableLines.push(rawLines[i]);
  }

  const parsedRows = [];

  // Detect tab-separated rows (including Chrome multi-line TSV where <td> contains <br>/<div>)
  const hasTabRows = tableLines.some(
    (l) => l.includes('\t') && COURSE_CODE_LINE_REGEX.test(l.split('\t')[0].trim())
  );

  if (hasTabRows) {
    // Group multi-line TSV rows into course chunks starting at each 9-digit course code
    const rowChunks = [];
    let currentChunk = null;
    for (const line of tableLines) {
      const firstCell = line.split('\t')[0].trim();
      if (COURSE_CODE_LINE_REGEX.test(firstCell)) {
        if (currentChunk) rowChunks.push(currentChunk);
        currentChunk = [line];
      } else if (currentChunk) {
        currentChunk.push(line);
      }
    }
    if (currentChunk) rowChunks.push(currentChunk);

    // Map header columns dynamically if available
    const colIdx = {
      code: headerCols ? headerCols.findIndex((h) => h.includes('รหัสวิชา')) : 0,
      section: headerCols ? headerCols.findIndex((h) => h.includes('ตอน')) : 1,
      title: headerCols ? headerCols.findIndex((h) => h.includes('รายวิชา') || h.includes('ชื่อวิชา')) : 2,
      credits: headerCols ? headerCols.findIndex((h) => h.includes('หน่วยกิต')) : 3,
      instructor: headerCols ? headerCols.findIndex((h) => h.includes('อาจารย์')) : 4,
      schedule: headerCols ? headerCols.findIndex((h) => h.includes('วันเวลาเรียน')) : 5,
      room: headerCols ? headerCols.findIndex((h) => h.includes('ห้อง')) : 6,
      midterm: headerCols ? headerCols.findIndex((h) => h.includes('สอบกลาง')) : 7,
      final: headerCols ? headerCols.findIndex((h) => h.includes('สอบปลาย')) : 8,
      remark: headerCols ? headerCols.findIndex((h) => h.includes('หมายเหตุ')) : 9,
    };
    const getCol = (cols, idx, fallbackIdx) => {
      const target = idx >= 0 ? idx : fallbackIdx;
      return target >= 0 && target < cols.length ? cols[target] : '';
    };

    for (const chunk of rowChunks) {
      // Join multi-line cells inside the same <tr> with a space so \t cell boundaries stay exact
      const joinedRow = chunk.join(' ');
      const cols = joinedRow.split('\t').map((c) => c.replace(/\s+/g, ' ').trim());
      const courseCode = getCol(cols, colIdx.code, 0);
      if (!COURSE_CODE_LINE_REGEX.test(courseCode)) continue;

      const section = getCol(cols, colIdx.section, 1);
      const rawTitle = getCol(cols, colIdx.title, 2);
      const { thaiName, engName } = splitBilingualCourseTitle(rawTitle);

      // Credits: strictly reject room numbers like "78-621" or numbers > 12; scan cols for 3(2-2-5) or valid credit
      let creditRaw = getCol(cols, colIdx.credits, 3);
      let credits = parseValidCredits(creditRaw);
      if (credits === null) {
        const specCell = cols.find((c) => CREDIT_SPEC_EMBEDDED_REGEX.test(c));
        if (specCell) {
          creditRaw = specCell;
          credits = parseValidCredits(specCell);
        } else {
          // Check typical credit positions (index 2..4) for standalone 0-12 number
          const fallbackCell = cols.slice(2, 5).find((c) => parseValidCredits(c) !== null);
          if (fallbackCell) {
            creditRaw = fallbackCell;
            credits = parseValidCredits(fallbackCell);
          }
        }
      }
      if (credits === null) {
        creditRaw = '';
        credits = 0;
      }

      const instructor = getCol(cols, colIdx.instructor, 4);

      // Schedule slots (fallback: scan all cols for day+time if shifted)
      let slots = parseScheduleSlots(getCol(cols, colIdx.schedule, 5));
      let matchedSchedCol = colIdx.schedule >= 0 ? colIdx.schedule : 5;
      if (slots.length === 0) {
        for (let ci = 1; ci < cols.length; ci++) {
          if (EXAM_DATETIME_REGEX.test(cols[ci])) continue;
          const s = parseScheduleSlots(cols[ci]);
          if (s.length > 0) {
            slots = s;
            matchedSchedCol = ci;
            break;
          }
        }
      }

      // Room (fallback: next column after matched schedule column)
      let roomRaw = getCol(cols, colIdx.room, 6);
      if ((!roomRaw || EXAM_DATETIME_REGEX.test(roomRaw)) && matchedSchedCol + 1 < cols.length) {
        if (isLikelyRoomLine(cols[matchedSchedCol + 1])) {
          roomRaw = cols[matchedSchedCol + 1];
        }
      }
      const room = normalizeRoom(roomRaw);

      let midterm = parseExamDateTime(getCol(cols, colIdx.midterm, 7));
      let finalExam = parseExamDateTime(getCol(cols, colIdx.final, 8));
      const pendingExams = [];

      // If column-based exam lookup missed exams due to shifted tabs, scan remaining columns
      if (!midterm && !finalExam) {
        const foundExams = cols.map((c) => parseExamDateTime(c)).filter(Boolean);
        if (foundExams.length >= 2) {
          midterm = foundExams[0];
          finalExam = foundExams[1];
        } else if (foundExams.length === 1) {
          pendingExams.push(foundExams[0]);
        }
      }

      const remark = getCol(cols, colIdx.remark, 9);

      parsedRows.push({
        courseCode,
        section,
        thaiName,
        engName,
        credits,
        creditSpec: creditRaw,
        instructor,
        slots,
        room,
        midterm,
        final: finalExam,
        pendingExams,
        remark,
      });
    }
  } else {
    // Line-by-line format (exact Visionnet browser copy format)
    // First merge split "15 ม.ค. 2570" + "เวลา 09:00-12:00" lines if separated by newline
    const mergedLines = [];
    for (let i = 0; i < tableLines.length; i++) {
      const cur = tableLines[i].trim();
      const next = i + 1 < tableLines.length ? tableLines[i + 1].trim() : '';
      if (DATE_ONLY_LINE_REGEX.test(cur) && TIME_ONLY_LINE_REGEX.test(next)) {
        mergedLines.push(`${cur} ${next}`);
        i++;
      } else {
        mergedLines.push(cur);
      }
    }

    const chunks = [];
    let current = null;
    for (const line of mergedLines) {
      if (COURSE_CODE_LINE_REGEX.test(line)) {
        if (current) chunks.push(current);
        current = [line];
      } else if (current) {
        current.push(line);
      }
    }
    if (current) chunks.push(current);

    for (const chunk of chunks) {
      const courseCode = chunk[0];
      const rest = chunk.slice(1);
      if (rest.length < 3) continue;

      let section = '';
      let rawTitle;
      let creditSpec = '';
      let credits = 0;
      let instructor = '';
      let slots = [];
      let room = '';
      const rawExams = [];
      const remarks = [];

      // Find landmark indexes
      const creditIdx = rest.findIndex((l) => CREDIT_SPEC_REGEX.test(l));
      const schedIdx = rest.findIndex((l, idx) => idx > creditIdx && parseScheduleSlots(l).length > 0);

      if (SECTION_TOKEN_REGEX.test(rest[0])) {
        section = rest[0];
      }

      if (creditIdx >= 1) {
        const titleStart = section ? 1 : 0;
        rawTitle = rest.slice(titleStart, creditIdx).join(' ').trim();
        creditSpec = rest[creditIdx];
        const cm = creditSpec.match(CREDIT_SPEC_REGEX);
        credits = cm ? parseFloat(cm[1]) : 0;
      } else {
        rawTitle = rest[section ? 1 : 0] || '';
      }

      if (schedIdx >= 0) {
        if (creditIdx >= 0 && schedIdx > creditIdx + 1) {
          instructor = rest.slice(creditIdx + 1, schedIdx).join(' ').trim();
        }
        slots = parseScheduleSlots(rest[schedIdx]);

        // Scan lines after schedule slot
        const afterSched = rest.slice(schedIdx + 1);
        for (const line of afterSched) {
          // Additional schedule slot on a subsequent line?
          const extraSlots = parseScheduleSlots(line);
          if (extraSlots.length > 0 && !EXAM_DATETIME_REGEX.test(line)) {
            slots = [...slots, ...extraSlots];
            continue;
          }
          // Exam date-time?
          const parsedEx = parseExamDateTime(line);
          if (parsedEx) {
            rawExams.push(parsedEx);
            continue;
          }
          // Room (first non-exam room-like token before exams)?
          if (!room && rawExams.length === 0 && isLikelyRoomLine(line)) {
            room = normalizeRoom(line);
            continue;
          }
          // Otherwise treat as remark
          if (line && line !== '-') {
            remarks.push(line);
          }
        }
      }

      const { thaiName, engName } = splitBilingualCourseTitle(rawTitle);

      parsedRows.push({
        courseCode,
        section,
        thaiName,
        engName,
        credits,
        creditSpec,
        instructor,
        slots,
        room,
        midterm: rawExams.length >= 2 ? rawExams[0] : null,
        final: rawExams.length >= 2 ? rawExams[1] : null,
        pendingExams: rawExams.length === 1 ? [rawExams[0]] : [],
        remark: remarks.join(' '),
      });
    }
  }

  // Disambiguate single-exam courses (like 080103034 with only Final exam) using median Midterm vs Final timestamps
  const midtermTimes = parsedRows.map((r) => r.midterm?.timestamp).filter(Number.isFinite);
  const finalTimes = parsedRows.map((r) => r.final?.timestamp).filter(Number.isFinite);

  const median = (arr) => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  const midAnchor = median(midtermTimes);
  const finAnchor = median(finalTimes);

  for (const row of parsedRows) {
    if (row.pendingExams && row.pendingExams.length === 1) {
      const ex = row.pendingExams[0];
      if (midAnchor !== null && finAnchor !== null) {
        const distMid = Math.abs(ex.timestamp - midAnchor);
        const distFin = Math.abs(ex.timestamp - finAnchor);
        if (distFin <= distMid) {
          row.final = ex;
        } else {
          row.midterm = ex;
        }
      } else {
        row.final = ex;
      }
    }
    delete row.pendingExams;
  }

  return { academicYear, rows: parsedRows };
}

/**
 * Converts parsed KMUTNB timetable rows into ready-to-save Schedule entries, Exam entries, and unique Enrolled Courses.
 */
function buildTimetableOutputs(rows, academicYear = '', existingCourses = []) {
  const colorByCode = new Map();
  let colorIdx = 0;

  const getColor = (code) => {
    if (!colorByCode.has(code)) {
      colorByCode.set(code, SCHEDULE_COLORS[colorIdx % SCHEDULE_COLORS.length]);
      colorIdx++;
    }
    return colorByCode.get(code);
  };

  const findClassroomCourseId = (code, engName, thaiName) => {
    if (!Array.isArray(existingCourses) || existingCourses.length === 0) return '';
    const lowerEng = (engName || '').toLowerCase();
    const lowerThai = (thaiName || '').toLowerCase();
    const matched = existingCourses.find((c) => {
      const cName = String(c?.name || '').toLowerCase();
      const cCode = String(c?.code || '').toLowerCase();
      if (code && (cName.includes(code) || cCode.includes(code))) return true;
      if (lowerEng && lowerEng.length >= 6 && cName.includes(lowerEng)) return true;
      if (lowerThai && lowerThai.length >= 4 && cName.includes(lowerThai)) return true;
      return false;
    });
    return matched?.id || '';
  };

  const scheduleEntries = [];
  const examMap = new Map();
  const enrolledMap = new Map();
  const nowIso = new Date().toISOString();

  for (const row of rows) {
    const color = getColor(row.courseCode);
    const displayTitle = row.engName || row.thaiName || row.courseCode;
    const sectionLabel = row.section ? ` (${row.section})` : '';
    const buildingInfo = decodeKmutnbBuilding(row.room);
    const matchedCourseId = findClassroomCourseId(row.courseCode, row.engName, row.thaiName);

    // 1. Build Schedule entries
    for (const slot of row.slots || []) {
      const id = `reg-${row.courseCode}-${(row.section || 'sec').replace(/[^a-zA-Z0-9]/g, '')}-${slot.day}-${slot.startTime.replace(':', '')}`;
      const noteParts = [
        row.thaiName && row.engName ? row.thaiName : '',
        row.instructor ? `อ.ผู้สอน: ${row.instructor}` : '',
        buildingInfo ? buildingInfo : '',
        row.remark || '',
      ].filter(Boolean);

      scheduleEntries.push({
        id,
        title: `${displayTitle}${sectionLabel}`,
        courseCode: row.courseCode,
        courseId: matchedCourseId,
        day: slot.day,
        date: '',
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: row.room || '',
        color,
        notes: noteParts.join(' • '),
        source: 'kmutnb-reg',
        updatedAt: nowIso,
      });
    }

    // 2. Build deduplicated Exam entries (Midterm & Final)
    const addExam = (examObj, examType) => {
      if (!examObj || !examObj.rawIsoDate) return;
      const dedupKey = `${row.courseCode}::${examObj.rawIsoDate}::${examObj.time}`;
      if (examMap.has(dedupKey)) return;
      const typeTag = examType === 'midterm' ? 'Midterm' : 'Final';
      examMap.set(dedupKey, {
        id: `reg-exam-${row.courseCode}-${examType}-${examObj.rawIsoDate}`,
        courseCode: row.courseCode,
        courseName: `${displayTitle} (${typeTag})`,
        date: examObj.date,
        rawIsoDate: examObj.rawIsoDate,
        time: examObj.time,
        room: '',
        seat: '',
        examType,
        isManual: true,
        source: 'kmutnb-reg',
        updatedAt: nowIso,
      });
    };

    addExam(row.midterm, 'midterm');
    addExam(row.final, 'final');

    // 3. Build deduplicated Enrolled Courses (S.1 + L.1 count credits ONCE!)
    if (!enrolledMap.has(row.courseCode)) {
      enrolledMap.set(row.courseCode, {
        courseCode: row.courseCode,
        thaiName: row.thaiName,
        engName: row.engName,
        credits: row.credits,
        creditSpec: row.creditSpec,
        instructor: row.instructor,
        sections: row.section ? [row.section] : [],
        remark: row.remark || '',
        academicYear,
      });
    } else {
      const existing = enrolledMap.get(row.courseCode);
      if (row.section && !existing.sections.includes(row.section)) {
        existing.sections.push(row.section);
      }
      if (!existing.credits && row.credits) existing.credits = row.credits;
    }
  }

  return {
    academicYear,
    entries: rows,
    scheduleEntries,
    examEntries: Array.from(examMap.values()).sort((a, b) => a.rawIsoDate.localeCompare(b.rawIsoDate)),
    enrolledCourses: Array.from(enrolledMap.values()),
  };
}

/**
 * Parses semester grades from plain text pasted from reg.kmutnb.ac.th/registrar/grade.
 */
function parseGradesFromText(text) {
  const rawLines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/^ +| +$/g, ''))
    .filter((l) => l.trim().length > 0);
  const lines = rawLines.map((l) => l.trim());

  const semesterStarts = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^ปีการศึกษา\s*(\d+)\s*\/\s*(\d{4})$/);
    if (m) {
      semesterStarts.push({ index: i, semesterId: `${m[1]}/${m[2]}` });
    }
  }

  if (semesterStarts.length === 0) {
    return [];
  }

  const semesters = [];

  for (let s = 0; s < semesterStarts.length; s++) {
    const start = semesterStarts[s].index + 1;
    const end = s + 1 < semesterStarts.length ? semesterStarts[s + 1].index : rawLines.length;
    const blockLines = [];
    for (let i = start; i < end; i++) {
      if (/^(?:หมายเหตุ\s*CA|@\s*\d{4}|©|Visionnet|ตารางเรียน\/สอบ)/i.test(lines[i])) break;
      blockLines.push(rawLines[i]);
    }

    const courses = [];
    let status = '';
    let semesterStats = null;
    let cumulativeStats = null;

    // Extract status line ("ผลการศึกษา : ปกติ" or "ผลการศึกษา : ยังไม่คำนวณ")
    const statusIdx = blockLines.findIndex((l) => /^ผลการศึกษา\s*[:：]/.test(l.trim()));
    if (statusIdx >= 0) {
      status = blockLines[statusIdx].trim().replace(/^ผลการศึกษา\s*[:：]\s*/, '').trim();
    }

    // Parse course rows before status/summary (supports single-line TSV, multi-line TSV, and line-per-cell)
    const courseLimit = statusIdx >= 0 ? statusIdx : blockLines.length;
    const courseSlice = blockLines.slice(0, courseLimit);
    const hasGradeTabs = courseSlice.some(
      (l) => l.includes('\t') && COURSE_CODE_LINE_REGEX.test(l.split('\t')[0].trim())
    );

    if (hasGradeTabs) {
      const gradeChunks = [];
      let cur = null;
      for (const line of courseSlice) {
        if (COURSE_CODE_LINE_REGEX.test(line.split('\t')[0].trim())) {
          if (cur) gradeChunks.push(cur);
          cur = [line];
        } else if (cur) {
          cur.push(line);
        }
      }
      if (cur) gradeChunks.push(cur);

      for (const chunk of gradeChunks) {
        const cols = chunk.join(' ').split('\t').map((c) => c.replace(/\s+/g, ' ').trim());
        if (!COURSE_CODE_LINE_REGEX.test(cols[0] || '')) continue;
        const rawGrade = cols[4] || '';
        courses.push({
          courseCode: cols[0],
          courseName: cols[1] || cols[0],
          section: cols[2] || '',
          credits: parseFloat(cols[3]) || 0,
          grade: normalizeGrade(rawGrade === '-' ? '' : rawGrade),
        });
      }
    } else {
      let i = 0;
      while (i < courseLimit) {
        const line = blockLines[i].trim();
        if (COURSE_CODE_LINE_REGEX.test(line)) {
          const courseCode = line;
          const courseName = (blockLines[i + 1] || courseCode).trim();
          const section = (blockLines[i + 2] || '').trim();
          const creditsRaw = (blockLines[i + 3] || '0').trim();
          const credits = parseFloat(creditsRaw) || 0;
          const possibleGrade = (blockLines[i + 4] || '').trim();

          if (i + 4 < courseLimit && VALID_GRADES_REGEX.test(possibleGrade)) {
            courses.push({
              courseCode,
              courseName,
              section,
              credits,
              grade: normalizeGrade(possibleGrade === '-' ? '' : possibleGrade),
            });
            i += 5;
          } else {
            courses.push({
              courseCode,
              courseName,
              section,
              credits,
              grade: '',
            });
            i += 4;
          }
          continue;
        }
        i++;
      }
    }

    // Parse summary numbers (10 numeric values after GPAX header: CA, CS, CG, GP, GPA, CA, CS, CG, GP, GPAX)
    const gpaxHeaderIdx = blockLines.findIndex((l) => l === 'GPAX' || /\bGPAX\b/.test(l));
    if (gpaxHeaderIdx >= 0) {
      const tailTokens = blockLines
        .slice(gpaxHeaderIdx + 1)
        .join(' ')
        .match(/\d+(?:\.\d+)?/g);
      if (tailTokens && tailTokens.length >= 10) {
        const nums = tailTokens.slice(0, 10).map(Number);
        semesterStats = {
          ca: nums[0],
          cs: nums[1],
          cg: nums[2],
          gp: nums[3],
          gpa: nums[4],
        };
        cumulativeStats = {
          ca: nums[5],
          cs: nums[6],
          cg: nums[7],
          gp: nums[8],
          gpax: nums[9],
        };
      }
    }

    semesters.push({
      semesterId: semesterStarts[s].semesterId,
      status: status || (courses.length > 0 ? 'ปกติ' : 'ยังไม่คำนวณ'),
      courses,
      semesterStats,
      cumulativeStats,
    });
  }

  return semesters;
}

/**
 * Unified KMUTNB Reg Parser entry point.
 * Accepts raw pasted text OR saved HTML from reg.kmutnb.ac.th/registrar/timetable, /enrollresult, and /grade
 * (either individually or pasted together in one blob).
 * Strictly drops student name, student ID, phone numbers, and non-academic content.
 */
export function parseKmutnbRegInput(rawInput, existingCourses = []) {
  const input = String(rawInput || '').trim();
  if (!input) {
    return {
      success: false,
      error: 'EMPTY_INPUT',
      timetable: { academicYear: '', entries: [], scheduleEntries: [], examEntries: [], enrolledCourses: [] },
      grades: { semesters: [] },
      meta: {
        hasTimetable: false,
        hasGrades: false,
        totalScheduleSlots: 0,
        totalExams: 0,
        totalEnrolledCourses: 0,
        totalEnrolledCredits: 0,
        totalSemesters: 0,
        totalGradeRows: 0,
      },
    };
  }

  const looksLikeHtml = /<(?:html|table|tr|tbody|div)[\s>]/i.test(input);
  let timetableRows;
  let academicYear = '';
  let semesters;

  if (looksLikeHtml) {
    const { htmlTimetableRows, htmlGradeSemesters, textFallback } = extractLinesFromHtml(input);
    timetableRows = htmlTimetableRows;
    semesters = htmlGradeSemesters;

    // Fallback to text extraction if HTML tables didn't yield rows (e.g. Angular/Vue div tables)
    if (timetableRows.length === 0) {
      const fromText = parseTimetableFromText(textFallback);
      timetableRows = fromText.rows;
      academicYear = fromText.academicYear;
    }
    if (semesters.length === 0) {
      semesters = parseGradesFromText(textFallback);
    }
    if (!academicYear) {
      const ym = textFallback.match(/ปีการศึกษา\s*(\d{4})/);
      if (ym) academicYear = ym[1];
    }
  } else {
    const ttResult = parseTimetableFromText(input);
    timetableRows = ttResult.rows;
    academicYear = ttResult.academicYear;
    semesters = parseGradesFromText(input);
  }

  const timetable = buildTimetableOutputs(timetableRows, academicYear, existingCourses);
  const totalGradeRows = semesters.reduce((sum, s) => sum + (s.courses?.length || 0), 0);
  const totalEnrolledCredits = timetable.enrolledCourses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
  const hasTimetable = timetable.entries.length > 0;
  const hasGrades = semesters.length > 0;

  return {
    success: hasTimetable || hasGrades,
    error: hasTimetable || hasGrades ? null : 'UNRECOGNIZED_FORMAT',
    timetable,
    grades: { semesters },
    meta: {
      hasTimetable,
      hasGrades,
      totalScheduleSlots: timetable.scheduleEntries.length,
      totalExams: timetable.examEntries.length,
      totalEnrolledCourses: timetable.enrolledCourses.length,
      totalEnrolledCredits,
      totalSemesters: semesters.length,
      totalGradeRows,
    },
  };
}

/**
 * Generates a safe client-side Bookmarklet that extracts only academic tables/text from the currently open
 * reg.kmutnb.ac.th tab and sends it to Classroom Hub via URL hash (which Academic.jsx clears immediately).
 */
export function buildKmutnbRegBookmarklet(targetOrigin) {
  const safeOrigin = String(targetOrigin || 'https://classrooms-hub.vercel.app').replace(/\/+$/, '');
  const code = `(()=>{try{if(!location.hostname.includes('kmutnb.ac.th')){alert('กรุณากดปุ่มนี้ขณะเปิดหน้า reg.kmutnb.ac.th (ตารางเรียน/สอบ หรือ ผลการศึกษา)');return;}const main=document.querySelector('main,.content,.container-fluid,table')?.closest('main,section,div')||document.body;const raw=(main.innerText||document.body.innerText||'').trim();if(!raw){alert('ไม่พบข้อมูลบนหน้านี้');return;}const bytes=new TextEncoder().encode(raw);let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));const payload=btoa(bin).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');window.open('${safeOrigin}/academic#reg-import='+payload,'_blank');}catch(e){alert('ไม่สามารถดึงข้อมูลได้: '+e.message);}})();`;
  return `javascript:${encodeURIComponent(code)}`;
}

/**
 * Decodes URL-safe base64 payload sent from the KMUTNB Reg Bookmarklet.
 */
export function decodeRegImportHashPayload(hashPayload) {
  try {
    if (!hashPayload || typeof hashPayload !== 'string') return '';
    const base64 = hashPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}
