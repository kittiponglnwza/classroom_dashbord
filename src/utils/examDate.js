// Helper to parse Thai/English exam dates from KMUTNB database
export const parseExamDate = (dateStr) => {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim().toLowerCase();
  
  // Try parsing ISO date first
  const isoMatch = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(cleanStr);
  }

  // Thai month names mapping
  const thaiMonths = {
    'มกราคม': 1, 'ม.ค.': 1, 'ม.ค': 1,
    'กุมภาพันธ์': 2, 'ก.พ.': 2, 'ก.พ': 2,
    'มีนาคม': 3, 'มี.ค.': 3, 'มี.ค': 3,
    'เมษายน': 4, 'เม.ย.': 4, 'เม.ย': 4,
    'พฤษภาคม': 5, 'พ.ค.': 5, 'พ.ค': 5,
    'มิถุนายน': 6, 'มิ.ย.': 6, 'มิ.ย': 6,
    'กรกฎาคม': 7, 'ก.ค.': 7, 'ก.ค': 7,
    'สิงหาคม': 8, 'ส.ค.': 8, 'ส.ค': 8,
    'กันยายน': 9, 'ก.ย.': 9, 'ก.ย': 9,
    'ตุลาคม': 10, 'ต.ค.': 10, 'ต.ค': 10,
    'พฤศจิกายน': 11, 'พ.ย.': 11, 'พ.ย': 11,
    'ธันวาคม': 12, 'ธ.ค.': 12, 'ธ.ค': 12
  };

  // English month names mapping
  const engMonths = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12
  };

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
    const dateParts = cleanStr.match(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
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
