import { Search } from 'lucide-react';
import { t } from '../../utils/i18n';

export default function ExamSearchForm({ studentId, setStudentId, onSearch, loading, lang }) {
  return (
    <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 md:p-8 max-w-2xl shadow-2xl hover:border-white/10 transition-all duration-500">
      <form onSubmit={onSearch} className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">
              {lang === 'en' ? 'Student Seating Search (KMUTNB Only)' : 'ค้นหาที่นั่งสอบนักศึกษา (เฉพาะ มจพ.)'}
            </label>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
              <input
                type="text"
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder={t('examSearchPlaceholder', lang)}
                maxLength={13}
                className="w-full bg-black/20 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-300"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-brand-500 hover:bg-brand-400 text-white font-bold text-sm px-6 py-3 rounded-2xl transition-all duration-300 shadow-lg shadow-brand-500/20 cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-2 hover:-translate-y-0.5"
            >
              {loading && <Search size={12} className="animate-spin" />}
              {t('searchBtn', lang)}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
