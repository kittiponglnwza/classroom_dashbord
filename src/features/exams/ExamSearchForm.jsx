import { useId } from 'react';
import { Search } from 'lucide-react';
import { t } from '../../utils/i18n';

export default function ExamSearchForm({ studentId, setStudentId, onSearch, loading, lang }) {
  const inputId = useId();
  return (
    <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6 max-w-2xl">
      <form onSubmit={onSearch} className="space-y-3">
        <label htmlFor={inputId} className="block text-xs font-semibold text-[#FFFFFF]">
          {lang === 'en' ? 'Student Seating Search (KMUTNB Only)' : 'ค้นหาที่นั่งสอบนักศึกษา (เฉพาะ มจพ.)'}
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#858585]" />
            <input
              id={inputId}
              type="text"
              inputMode="numeric"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder={t('examSearchPlaceholder', lang)}
              maxLength={20}
              className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#007ACC] hover:bg-[#1177BB] text-white font-medium text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-2"
          >
            {loading && <Search size={13} className="animate-spin" />}
            <span>{t('searchBtn', lang)}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
