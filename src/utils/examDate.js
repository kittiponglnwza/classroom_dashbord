import { EXAM_CONFIG } from '../config/exam';

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

const normalizeExamDateInput = (str) => {
  return String(str)
    .replace(/[๐-๙]/g, (ch) => String(THAI_DIGITS.indexOf(ch)))
    .trim()
    .toLowerCase();
};

const validateCalendarDate = (year, month, day) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > 2200) return null;
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return candidate;
};

const normalizeExamYear = (rawYear) => {
  let year = rawYear;
  if (year >= 2400) {
    year -= 543;
  } else if (year >= 0 && year < 100) {
    year = year > 50 ? 2500 + year - 543 : 2000 + year;
  }
  return year;
};

// Helper to parse Thai/English exam dates from KMUTNB database
export const parseExamDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const cleanStr = normalizeExamDateInput(dateStr);
  if (!cleanStr) return null;

  // Try ISO YYYY-MM-DD first
  const isoMatch = cleanStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|t|\s)/);
  if (isoMatch) {
    const year = normalizeExamYear(parseInt(isoMatch[1], 10));
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return validateCalendarDate(year, month, day);
  }

  // Try YYYY/M/D or YYYY.M.D format explicitly
  const yearFirstMatch = cleanStr.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?:\b|$)/);
  if (yearFirstMatch) {
    const year = normalizeExamYear(parseInt(yearFirstMatch[1], 10));
    const month = parseInt(yearFirstMatch[2], 10);
    const day = parseInt(yearFirstMatch[3], 10);
    return validateCalendarDate(year, month, day);
  }

  // Strip embedded exam time ranges before scanning date numbers (e.g. "12 พ.ค. 69 09:00-12:00")
  const withoutTime = cleanStr.replace(/\b\d{1,2}[:.]\d{2}(?:\s*[-–]\s*\d{1,2}[:.]\d{2})?\b/g, ' ');

  const thaiEntries = Object.entries(EXAM_CONFIG.thaiMonths).sort((a, b) => b[0].length - a[0].length);
  const engEntries = Object.entries(EXAM_CONFIG.engMonths).sort((a, b) => b[0].length - a[0].length);

  let day = null;
  let month = null;
  let year = null;
  let monthFound = false;

  for (const [mName, mVal] of thaiEntries) {
    if (withoutTime.includes(mName)) {
      month = mVal;
      monthFound = true;
      break;
    }
  }

  if (!monthFound) {
    for (const [mName, mVal] of engEntries) {
      if (withoutTime.includes(mName)) {
        month = mVal;
        monthFound = true;
        break;
      }
    }
  }

  const numbers = withoutTime.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;

  if (monthFound) {
    if (numbers.length >= 2) {
      day = parseInt(numbers[0], 10);
      year = parseInt(numbers[1], 10);
    } else {
      day = parseInt(numbers[0], 10);
      year = new Date().getFullYear();
    }
  } else {
    const dateParts = withoutTime.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (dateParts) {
      day = parseInt(dateParts[1], 10);
      month = parseInt(dateParts[2], 10);
      year = parseInt(dateParts[3], 10);
    } else if (numbers.length >= 3) {
      day = parseInt(numbers[0], 10);
      month = parseInt(numbers[1], 10);
      year = parseInt(numbers[2], 10);
    }
  }

  if (!day || !month || year === null) return null;
  year = normalizeExamYear(year);

  return validateCalendarDate(year, month, day);
};
