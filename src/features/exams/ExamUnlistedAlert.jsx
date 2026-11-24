import { AlertCircle, FileText, ClipboardCheck, ExternalLink } from 'lucide-react';
import { t } from '../../utils/i18n';
import { sanitizeExternalUrl } from '../../utils/sanitize';

export default function ExamUnlistedAlert({ unlistedInfo, lang }) {
  if (!unlistedInfo) return null;

  const safePdfLink = sanitizeExternalUrl(unlistedInfo.pdfLink);
  const safeFormLink = sanitizeExternalUrl(unlistedInfo.formLink);

  return (
    <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 space-y-5">
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 bg-[#1E1E1E] border border-rose-500/30 rounded-xl text-rose-400 shrink-0">
          <AlertCircle size={20} />
        </div>
        <div className="space-y-1 min-w-0">
          <h3 className="font-semibold text-[#FFFFFF] text-sm leading-snug">
            {t('noSeatingAlert', lang)}
          </h3>
          <p className="text-xs text-rose-300 leading-relaxed">
            {lang === 'en'
              ? 'You are not registered in the exam listing for this semester. Please submit a petition request before the university deadline.'
              : 'ไม่พบรายชื่อผู้มีสิทธิ์เข้าสอบของท่านในระบบประจำภาคการศึกษานี้ โปรดยื่นเอกสารคำร้องขอเข้าสอบตามขั้นตอนให้เสร็จสิ้นภายในกำหนดเวลา'}
          </p>
        </div>
      </div>

      {(safePdfLink || safeFormLink) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-rose-500/25 pt-4">
          {safePdfLink && (
            <a
              href={safePdfLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#1E1E1E] hover:bg-[#2A2D2E] border border-[#3C3C3C] text-[#D4D4D4] font-medium text-xs py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
            >
              <FileText size={14} className="text-rose-400" />
              <span>{t('noSeatingAction1', lang)}</span>
              <ExternalLink size={11} className="text-[#858585]" />
            </a>
          )}
          {safeFormLink && (
            <a
              href={safeFormLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
            >
              <ClipboardCheck size={14} />
              <span>{t('noSeatingAction2', lang)}</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
