import { EXAM_CONFIG } from '../config/exam';

// Helper to parse Thai/English exam dates from KMUTNB database
export const parseExamDate = (dateStr) => {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim().toLowerCase();
  
  // Try parsing ISO date first
  const isoMatch = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, isoY, isoM, isoD] = isoMatch;
    return new Date(parseInt(isoY), parseInt(isoM) - 1, parseInt(isoD));
  }

  const thaiMonths = EXAM_CONFIG.thaiMonths;
  const engMonths = EXAM_CONFIG.engMonths;

  const numbers = cleanStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;

  let day = null;
  let month = null;
  let year = null;

  let monthFound = false;
  for (const [mName, mVal] of Object.entries(thaiMonths)) {
    if (cleanStr.includes(mName)) {
      month = mVal;
      monthFound = true;
      break;
    }
  }

  if (!monthFound) {
    for (const [mName, mVal] of Object.entries(engMonths)) {
      if (cleanStr.includes(mName)) {
        month = mVal;
        monthFound = true;
        break;
      }
    }
  }

  if (monthFound) {
    if (numbers.length >= 2) {
      day = parseInt(numbers[0], 10);
      year = parseInt(numbers[1], 10);
    } else if (numbers.length === 1) {
      day = parseInt(numbers[0], 10);
      year = new Date().getFullYear();
    }
  } else {
    const dateParts = cleanStr.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
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

  if (!day || !month || !year) return null;

  if (year >= 2400) {
    year -= 543;
  } else if (year < 100) {
    if (year > 50) {
      year = 2500 + year - 543;
    } else {
      year = 2000 + year;
    }
  }

  return new Date(year, month - 1, day);
};
