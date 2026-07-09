export const EXAM_CONFIG = {
  proxyEndpoint: '/api/exam-room',
  fallbackPdfLink: 'https://drive.google.com/file/d/16iviW6ZcL0G0VK8lQFPJ2cNEmiPrxBnj/view?usp=sharing',
  fallbackFormLink: 'https://forms.gle/ddH1GnaBQzaa57xV9',
  
  // Custom month replacements configurations if needed (replaces hardcoded mar/july hack)
  monthReplacements: [
    // format: { pattern: /regex/i, replacement: 'string' }
    // We can keep these empty or configure them for local university requirements
  ],

  thaiMonths: {
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
  },

  engMonths: {
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
  }
};
