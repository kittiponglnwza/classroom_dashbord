import { useState, useEffect, useRef } from 'react';
import { Search, Filter, ArrowUpDown, LayoutGrid, Kanban, List, X } from 'lucide-react';
import { t } from '../utils/i18n';
import { useDebounce } from '../hooks/useDebounce';

export default function TaskFilters({
  searchQuery, setSearchQuery,
  selectedCourse, setSelectedCourse,
  selectedStatus, setSelectedStatus,
  sortBy, setSortBy,
  viewType, setViewType,
  clearFilters,
  visibleCourses, lang
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debouncedSearch = useDebounce(localSearch, 300);
  const lastPushRef = useRef(searchQuery);

  // Sync external URL changes into local input only when NOT caused by our own debounce
  useEffect(() => {
    if (searchQuery !== lastPushRef.current) {
      lastPushRef.current = searchQuery;
      setLocalSearch(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedSearch !== searchQuery) {
      lastPushRef.current = debouncedSearch;
      setSearchQuery(debouncedSearch);
    }
  }, [debouncedSearch, searchQuery, setSearchQuery]);

  const hasActiveFilters = Boolean(
    localSearch ||
    (selectedCourse && selectedCourse !== 'all') ||
    (viewType !== 'kanban' && selectedStatus && selectedStatus !== 'all')
  );

  return (
    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
      {/* Search */}
      <div className="relative flex-1 w-full lg:max-w-sm">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-muted)] pointer-events-none">
          <Search size={15} strokeWidth={1.5} />
        </span>
        <input
          type="text"
          aria-label={t('searchPlaceholder', lang)}
          placeholder={t('searchPlaceholder', lang)}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="w-full min-h-11 sm:min-h-0 sm:h-9 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg pl-9 pr-10 text-base sm:text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-colors"
        />
        {localSearch && (
          <button
            type="button"
            onClick={() => {
              setLocalSearch('');
              lastPushRef.current = '';
              setSearchQuery('');
            }}
            aria-label="Clear search"
            className="absolute inset-y-0 right-0 w-10 sm:w-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-heading)] cursor-pointer rounded-r-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <X aria-hidden="true" size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Filters and Sorting */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 min-w-0">
        <div className={`flex items-center gap-1.5 px-3 min-h-11 sm:min-h-0 sm:h-9 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] min-w-0 ${viewType === 'kanban' ? 'col-span-2 sm:col-span-1' : ''}`}>
          <Filter aria-hidden="true" size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
          <select
            aria-label={t('allSubjects', lang)}
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="bg-transparent text-base sm:text-xs font-medium text-[var(--text-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] cursor-pointer pr-1 rounded w-full min-w-0 truncate"
          >
            <option value="all">{t('allSubjects', lang)}</option>
            {visibleCourses.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {viewType !== 'kanban' && (
          <div className="flex items-center gap-1.5 px-3 min-h-11 sm:min-h-0 sm:h-9 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] min-w-0">
            <select
              aria-label={t('allStatuses', lang)}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-base sm:text-xs font-medium text-[var(--text-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] cursor-pointer rounded w-full min-w-0"
            >
              <option value="all">{t('allStatuses', lang)}</option>
              <option value="todo">{t('todo', lang)}</option>
              <option value="doing">{t('doing', lang)}</option>
              <option value="done">{t('done', lang)}</option>
              <option value="read">{t('read', lang)}</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-3 min-h-11 sm:min-h-0 sm:h-9 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] min-w-0">
          <ArrowUpDown aria-hidden="true" size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
          <select
            aria-label="Sort assignments"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent text-base sm:text-xs font-medium text-[var(--text-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] cursor-pointer rounded w-full min-w-0"
          >
            <option value="due-asc">{t('sortByDueAsc', lang)}</option>
            <option value="due-desc">{t('sortByDueDesc', lang)}</option>
            <option value="points-desc">{t('sortByPointsDesc', lang)}</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setLocalSearch('');
              lastPushRef.current = '';
              if (clearFilters) {
                clearFilters();
              } else {
                setSearchQuery('');
                setSelectedCourse('all');
                setSelectedStatus('all');
              }
            }}
            className="text-xs font-medium text-[var(--primary-bright)] hover:text-[var(--text-heading)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border-strong)] px-3 h-9 rounded-lg transition-colors cursor-pointer justify-self-start"
          >
            {t('clearFilters', lang)}
          </button>
        )}

        <div className="col-span-2 sm:col-span-1 flex items-center justify-end sm:justify-start border border-[var(--border)] rounded-lg p-1 bg-[var(--app-bg)] justify-self-end sm:ml-auto">
          <button
            type="button"
            onClick={() => setViewType('list')}
            aria-label="List View"
            aria-pressed={viewType === 'list'}
            className={`p-1.5 rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] ${
              viewType === 'list' ? 'bg-[var(--surface-elevated)] text-[var(--primary-bright)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title="List View"
          >
            <List size={15} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setViewType('grid')}
            aria-label="Grid View"
            aria-pressed={viewType === 'grid'}
            className={`p-1.5 rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] ${
              viewType === 'grid' ? 'bg-[var(--surface-elevated)] text-[var(--primary-bright)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title="Grid View"
          >
            <LayoutGrid size={15} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setViewType('kanban')}
            aria-label="Kanban Board"
            aria-pressed={viewType === 'kanban'}
            className={`p-1.5 rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] ${
              viewType === 'kanban' ? 'bg-[var(--surface-elevated)] text-[var(--primary-bright)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title="Kanban Board"
          >
            <Kanban size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
