import { useId } from 'react';
import { Search } from 'lucide-react';
import { t } from '../../utils/i18n';

export default function ExamSearchForm({ studentId, setStudentId, onSearch, loading, lang }) {
  const inputId = useId();
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 sm:p-6">
      <form onSubmit={onSearch} className="space-y-3">
        <label htmlFor={inputId} className="block text-xs font-medium text-[var(--text-heading)]">
          {lang === 'en' ? 'Student Seating Search (KMUTNB Only)' : 'ค้นหาที่นั่งสอบนักศึกษา (เฉพาะ มจพ.)'}
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search aria-hidden="true" size={15} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              id={inputId}
              type="text"
              inputMode="numeric"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder={t('examSearchPlaceholder', lang)}
              maxLength={20}
              className="w-full min-h-11 sm:min-h-0 sm:h-10 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg pl-10 pr-4 text-base sm:text-sm font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-xs px-5 min-h-11 sm:min-h-0 sm:h-10 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-bright)]"
          >
            {loading && <Search aria-hidden="true" size={14} strokeWidth={1.5} className="animate-spin" />}
            <span>{t('searchBtn', lang)}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
