import { CheckCircle2, Clock, ListTodo, ClipboardList, Timer } from 'lucide-react';
import { t } from '../utils/i18n';

// Helper to parse Thai/English exam dates from KMUTNB database
const parseExamDate = (dateStr) => {
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

export default function TaskStats({ assignments = [], lang = 'en', exams = [] }) {
  const total = assignments.length;
  const todo = assignments.filter(a => a.status === 'todo').length;
  const done = assignments.filter(a => a.status === 'done').length;

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  // Find next upcoming exam countdown
  let examCountdownStr = lang === 'en' ? 'No Exam' : 'ไม่มีสอบ';
  let closestExamName = '';

  if (exams && exams.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingExams = exams.filter(exam => {
      const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
      return parsedDate ? parsedDate >= today : true;
    });

    upcomingExams.sort((a, b) => {
      const dateA = parseExamDate(a.rawIsoDate || a.date) || new Date(8640000000000000);
      const dateB = parseExamDate(b.rawIsoDate || b.date) || new Date(8640000000000000);
      return dateA - dateB;
    });

    if (upcomingExams.length > 0) {
      const closest = upcomingExams[0];
      closestExamName = closest.courseName;
      const targetDate = parseExamDate(closest.rawIsoDate || closest.date);
      
      if (targetDate) {
        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
          examCountdownStr = lang === 'en' ? 'Today' : 'วันนี้';
        } else if (diffDays === 1) {
          examCountdownStr = lang === 'en' ? 'Tomorrow' : 'พรุ่งนี้';
        } else {
          examCountdownStr = lang === 'en' ? `${diffDays} days` : `${diffDays} วัน`;
        }
      }
    }
  }

  const stats = [
    {
      label: t('allAssignments', lang),
      value: total,
      icon: ClipboardList,
      color: 'text-brand-400 bg-brand-500/10 border-brand-500/10'
    },
    {
      label: t('todo', lang),
      value: todo,
      icon: ListTodo,
      color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/10'
    },
    {
      label: lang === 'en' ? 'Exam Countdown' : 'นับถอยหลังสอบ',
      value: examCountdownStr,
      subValue: closestExamName ? (lang === 'en' ? `for ${closestExamName}` : `วิชา ${closestExamName}`) : '',
      icon: Timer,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/10'
    },
    {
      label: t('completed', lang),
      value: done,
      icon: CheckCircle2,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div 
            key={stat.label}
            className="bg-dark-card border border-dark-border rounded-xl p-5 hover:border-dark-border/80 transition-all duration-300 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-dark-muted font-medium mb-1">{stat.label}</p>
                <h4 className="text-xl font-bold font-heading text-white truncate max-w-[125px]" title={stat.value}>{stat.value}</h4>
                {stat.subValue && (
                  <p className="text-[9px] text-dark-muted truncate mt-0.5 max-w-[125px]" title={stat.subValue}>
                    {stat.subValue}
                  </p>
                )}
              </div>
              <div className={`p-2.5 rounded-lg border ${stat.color} shrink-0`}>
                <stat.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar Container */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <div className="flex items-center justify-between text-sm mb-2.5">
          <span className="font-semibold text-white">{t('completionProgress', lang)}</span>
          <span className="font-bold text-brand-400">{percent}% ({done}/{total} {t('doneStatus', lang)})</span>
        </div>
        <div className="w-full bg-dark-sidebar border border-dark-border rounded-full h-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-brand-600 to-brand-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
