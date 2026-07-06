import { AlertCircle, FileText, ClipboardCheck, ExternalLink } from 'lucide-react';
import { t } from '../../utils/i18n';

export default function ExamUnlistedAlert({ unlistedInfo, lang }) {
  if (!unlistedInfo) return null;

  return (
    <div className="bg-rose-950/5 border border-rose-500/20 rounded-2xl p-6 md:p-8 space-y-6 max-w-2xl shadow-lg shadow-rose-950/5 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400 shrink-0">
          <AlertCircle size={22} />
        </div>
        <div className="space-y-1.5 min-w-0">
          <h3 className="font-bold text-white text-base leading-tight">
            {t('noSeatingAlert', lang)}
          </h3>
          <p className="text-xs text-rose-400/90 leading-relaxed">
            {lang === 'en' 
              ? 'You are not registered in the exam listing for this semester. Please submit a petition request before the university deadline.' 
              : 'ไม่พบรายชื่อผู้มีสิทธิ์เข้าสอบของท่านในระบบประจำภาคการศึกษานี้ โปรดยื่นเอกสารคำร้องขอเข้าสอบตามขั้นตอนให้เสร็จสิ้นภายในกำหนดเวลา'}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-rose-500/10 pt-5">
        <a 
          href={unlistedInfo.pdfLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-dark-sidebar/40 hover:bg-dark-hover border border-rose-500/20 text-white font-medium text-xs py-3 px-4 rounded-xl transition-all cursor-pointer shadow-sm hover:translate-y-0.5 active:scale-98"
        >
          <FileText size={14} className="text-rose-400" />
          {t('noSeatingAction1', lang)}
          <ExternalLink size={11} className="text-dark-muted" />
        </a>
        <a 
          href={unlistedInfo.formLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer shadow-md hover:translate-y-0.5 active:scale-98"
        >
          <ClipboardCheck size={14} className="text-rose-400" />
          {t('noSeatingAction2', lang)}
          <ExternalLink size={11} className="text-rose-300/60" />
        </a>
      </div>
    </div>
  );
}
