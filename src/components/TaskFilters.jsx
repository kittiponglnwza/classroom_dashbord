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
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    setSearchQuery(debouncedSearch);
  }, [debouncedSearch, setSearchQuery]);

  useEffect(() => {
    if (searchQuery === '') {
      setLocalSearch('');
    }
  }, [searchQuery]);

  return (
    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between opacity-0 animate-fade-in" style={{ animationDelay: '250ms' }}>
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-dark-muted">
          <Search size={16} />
        </span>
        <input
          type="text"
          placeholder={t('searchPlaceholder', lang)}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="w-full bg-dark-sidebar/40 border border-transparent rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-dark-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus:border-brand-500 focus:bg-dark-sidebar/80 transition-all duration-300"
        />
      </div>

      {/* Filters and Sorting */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all hover:bg-white/5">
          <Filter size={14} className="text-zinc-400" />
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="bg-transparent text-sm font-semibold text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer pr-1"
          >
            <option value="all">{t('allSubjects', lang)}</option>
            {visibleCourses.map(c => (
              <option key={c.id} value={c.name} className="bg-dark-sidebar">{c.name}</option>
            ))}
          </select>
        </div>

        {viewType !== 'kanban' && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all hover:bg-white/5">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-sm font-semibold text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer"
            >
              <option value="all" className="bg-dark-sidebar">{t('allStatuses', lang)}</option>
              <option value="todo" className="bg-dark-sidebar">{t('todo', lang)}</option>
              <option value="doing" className="bg-dark-sidebar">{t('doing', lang)}</option>
              <option value="done" className="bg-dark-sidebar">{t('done', lang)}</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all hover:bg-white/5">
          <ArrowUpDown size={14} className="text-zinc-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent text-sm font-semibold text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer"
          >
            <option value="due-asc" className="bg-dark-sidebar">{t('sortByDueAsc', lang)}</option>
            <option value="due-desc" className="bg-dark-sidebar">{t('sortByDueDesc', lang)}</option>
            <option value="points-desc" className="bg-dark-sidebar">{t('sortByPointsDesc', lang)}</option>
          </select>
        </div>

        <div className="flex items-center border border-white/5 rounded-xl p-0.5 bg-white/5 ml-auto md:ml-2">
          <button
            onClick={() => setViewType('list')}
            className={`p-2 rounded-lg transition-all duration-300 ${viewType === 'list' ? 'bg-white/10 text-brand-400 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            title="List View"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewType('grid')}
            className={`p-2 rounded-lg transition-all duration-300 ${viewType === 'grid' ? 'bg-white/10 text-brand-400 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            title="Grid View"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewType('kanban')}
            className={`p-2 rounded-lg transition-all duration-300 ${viewType === 'kanban' ? 'bg-white/10 text-brand-400 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            title="Kanban Board"
          >
            <Kanban size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
