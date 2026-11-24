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
    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-[#252526] border border-[#3C3C3C] rounded-2xl p-3">
      {/* Search */}
      <div className="relative flex-1 w-full lg:max-w-sm">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#858585]">
          <Search size={15} />
        </span>
        <input
          type="text"
          aria-label={t('searchPlaceholder', lang)}
          placeholder={t('searchPlaceholder', lang)}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl pl-9 pr-8 py-2 text-xs text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] transition-colors"
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
            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-[#858585] hover:text-[#FFFFFF] cursor-pointer"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Filters and Sorting */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 min-w-0">
        <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#1E1E1E] border border-[#3C3C3C] min-w-0 ${viewType === 'kanban' ? 'col-span-2 sm:col-span-1' : ''}`}>
          <Filter size={13} className="text-[#858585] shrink-0" />
          <select
            aria-label={t('allSubjects', lang)}
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="bg-transparent text-xs font-medium text-[#D4D4D4] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#007ACC] cursor-pointer pr-1 rounded w-full min-w-0 truncate"
          >
            <option value="all">{t('allSubjects', lang)}</option>
            {visibleCourses.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {viewType !== 'kanban' && (
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#1E1E1E] border border-[#3C3C3C] min-w-0">
            <select
              aria-label={t('allStatuses', lang)}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-xs font-medium text-[#D4D4D4] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#007ACC] cursor-pointer rounded w-full min-w-0"
            >
              <option value="all">{t('allStatuses', lang)}</option>
              <option value="todo">{t('todo', lang)}</option>
              <option value="doing">{t('doing', lang)}</option>
              <option value="done">{t('done', lang)}</option>
              <option value="read">{t('read', lang)}</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#1E1E1E] border border-[#3C3C3C] min-w-0">
          <ArrowUpDown size={13} className="text-[#858585] shrink-0" />
          <select
            aria-label="Sort assignments"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent text-xs font-medium text-[#D4D4D4] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#007ACC] cursor-pointer rounded w-full min-w-0"
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
            className="text-xs font-medium text-[#3794FF] hover:text-[#FFFFFF] bg-[#007ACC]/15 hover:bg-[#007ACC]/30 border border-[#007ACC]/40 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer justify-self-start"
          >
            {t('clearFilters', lang)}
          </button>
        )}

        <div className="col-span-2 sm:col-span-1 flex items-center justify-end sm:justify-start border border-[#3C3C3C] rounded-xl p-0.5 bg-[#1E1E1E] justify-self-end sm:ml-auto">
          <button
            type="button"
            onClick={() => setViewType('list')}
            aria-label="List View"
            aria-pressed={viewType === 'list'}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#007ACC] ${
              viewType === 'list' ? 'bg-[#094771]/70 text-[#3794FF]' : 'text-[#858585] hover:text-[#D4D4D4]'
            }`}
            title="List View"
          >
            <List size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewType('grid')}
            aria-label="Grid View"
            aria-pressed={viewType === 'grid'}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#007ACC] ${
              viewType === 'grid' ? 'bg-[#094771]/70 text-[#3794FF]' : 'text-[#858585] hover:text-[#D4D4D4]'
            }`}
            title="Grid View"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewType('kanban')}
            aria-label="Kanban Board"
            aria-pressed={viewType === 'kanban'}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#007ACC] ${
              viewType === 'kanban' ? 'bg-[#094771]/70 text-[#3794FF]' : 'text-[#858585] hover:text-[#D4D4D4]'
            }`}
            title="Kanban Board"
          >
            <Kanban size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
