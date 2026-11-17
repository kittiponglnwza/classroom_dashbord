import { AlertCircle, FileText, ClipboardCheck, ExternalLink } from 'lucide-react';
import { t } from '../../utils/i18n';

export default function ExamUnlistedAlert({ unlistedInfo, lang }) {
  if (!unlistedInfo) return null;

  return (
    <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-6 space-y-5 max-w-2xl shadow-2xs">
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 bg-white border border-rose-200 rounded-xl text-rose-600 shrink-0">
          <AlertCircle size={20} />
        </div>
        <div className="space-y-1 min-w-0">
          <h3 className="font-semibold text-[#1D1D1F] text-sm leading-snug">
            {t('noSeatingAlert', lang)}
          </h3>
          <p className="text-xs text-rose-700 leading-relaxed">
            {lang === 'en'
              ? 'You are not registered in the exam listing for this semester. Please submit a petition request before the university deadline.'
              : 'ไม่พบรายชื่อผู้มีสิทธิ์เข้าสอบของท่านในระบบประจำภาคการศึกษานี้ โปรดยื่นเอกสารคำร้องขอเข้าสอบตามขั้นตอนให้เสร็จสิ้นภายในกำหนดเวลา'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-rose-200/70 pt-4">
        <a
          href={unlistedInfo.pdfLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-white hover:bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] font-medium text-xs py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
        >
          <FileText size={14} className="text-rose-600" />
          <span>{t('noSeatingAction1', lang)}</span>
          <ExternalLink size={11} className="text-[#6E6E73]" />
        </a>
        <a
          href={unlistedInfo.formLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
        >
          <ClipboardCheck size={14} />
          <span>{t('noSeatingAction2', lang)}</span>
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}
