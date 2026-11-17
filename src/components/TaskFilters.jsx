import { useState, useEffect } from 'react';
import { Search, Filter, ArrowUpDown, LayoutGrid, Kanban, List } from 'lucide-react';
import { t } from '../utils/i18n';
import { useDebounce } from '../hooks/useDebounce';

export default function TaskFilters({
  searchQuery, setSearchQuery,
  selectedCourse, setSelectedCourse,
  selectedStatus, setSelectedStatus,
  sortBy, setSortBy,
  viewType, setViewType,
  visibleCourses, lang
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    if (debouncedSearch !== searchQuery) {
      setSearchQuery(debouncedSearch);
    }
  }, [debouncedSearch, searchQuery, setSearchQuery]);

  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    if (searchQuery === '') {
      setLocalSearch('');
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-white border border-[#D2D2D7]/80 rounded-2xl p-3 shadow-2xs">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#6E6E73]">
          <Search size={15} />
        </span>
        <input
          type="text"
          placeholder={t('searchPlaceholder', lang)}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="w-full bg-[#F5F5F7] border border-[#D2D2D7]/80 rounded-xl pl-9 pr-4 py-2 text-xs text-[#1D1D1F] placeholder-[#6E6E73] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus:bg-white transition-colors"
        />
      </div>

      {/* Filters and Sorting */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]/70">
          <Filter size={13} className="text-[#6E6E73]" />
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="bg-transparent text-xs font-medium text-[#1D1D1F] focus:outline-none cursor-pointer pr-1"
          >
            <option value="all">{t('allSubjects', lang)}</option>
            {visibleCourses.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {viewType !== 'kanban' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]/70">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-xs font-medium text-[#1D1D1F] focus:outline-none cursor-pointer"
            >
              <option value="all">{t('allStatuses', lang)}</option>
              <option value="todo">{t('todo', lang)}</option>
              <option value="doing">{t('doing', lang)}</option>
              <option value="done">{t('done', lang)}</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]/70">
          <ArrowUpDown size={13} className="text-[#6E6E73]" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent text-xs font-medium text-[#1D1D1F] focus:outline-none cursor-pointer"
          >
            <option value="due-asc">{t('sortByDueAsc', lang)}</option>
            <option value="due-desc">{t('sortByDueDesc', lang)}</option>
            <option value="points-desc">{t('sortByPointsDesc', lang)}</option>
          </select>
        </div>

        <div className="flex items-center border border-[#D2D2D7]/80 rounded-xl p-0.5 bg-[#F5F5F7] ml-auto md:ml-1">
          <button
            type="button"
            onClick={() => setViewType('list')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewType === 'list' ? 'bg-white text-[#0071E3] shadow-2xs' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
            title="List View"
          >
            <List size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewType('grid')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewType === 'grid' ? 'bg-white text-[#0071E3] shadow-2xs' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
            title="Grid View"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewType('kanban')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewType === 'kanban' ? 'bg-white text-[#0071E3] shadow-2xs' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
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
