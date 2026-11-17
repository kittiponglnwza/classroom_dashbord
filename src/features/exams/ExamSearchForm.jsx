import { Search } from 'lucide-react';
import { t } from '../../utils/i18n';

export default function ExamSearchForm({ studentId, setStudentId, onSearch, loading, lang }) {
  return (
    <div className="bg-white border border-[#D2D2D7]/80 rounded-2xl p-6 max-w-2xl shadow-2xs">
      <form onSubmit={onSearch} className="space-y-3">
        <label className="block text-xs font-semibold text-[#1D1D1F]">
          {lang === 'en' ? 'Student Seating Search (KMUTNB Only)' : 'ค้นหาที่นั่งสอบนักศึกษา (เฉพาะ มจพ.)'}
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6E6E73]" />
            <input
              type="text"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder={t('examSearchPlaceholder', lang)}
              maxLength={13}
              className="w-full bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1D1D1F] placeholder-[#6E6E73] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-2"
          >
            {loading && <Search size={13} className="animate-spin" />}
            <span>{t('searchBtn', lang)}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
