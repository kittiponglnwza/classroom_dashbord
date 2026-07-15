import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import AssignmentCard from '../components/AssignmentCard';
import { 
  User, BookOpen, ChevronRight, Eye, EyeOff, ArrowLeft, 
  Megaphone, FileText, ExternalLink, Calendar, 
  Check, Trash2, Pin, Search, ChevronDown, ChevronUp, 
  LayoutGrid, List, Hash, Filter, FolderOpen
} from 'lucide-react';
import { t } from '../utils/i18n';
import { 
  getCourseBorderTopColor, getCourseTextColor, getTabStyles, 
  getTabBadgeStyles, getTrackButtonStyles, getCourseBadgeColor 
} from '../utils/colors';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';

function ResourceCard({ 
  resource, 
  assignments = [], 
  onTrackAsAssignment, 
  onUntrackAssignment, 
  courseColor,
  lang = 'en'
}) {
  const { id, title, description, type, creationTime, attachments, googleLink } = resource;
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedDate = new Date(creationTime).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
    day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
  });

  const getResourceTypeStyles = () => {
    if (type === 'announcement') {
      return {
        label: t('announcementType', lang),
        badge: 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
        icon: <Megaphone size={14} className="text-amber-400" />
      };
    } else {
      return {
        label: t('materialType', lang),
        badge: 'text-blue-400 bg-blue-500/10 border border-blue-500/20',
        icon: <FileText size={14} className="text-blue-400" />
      };
    }
  };

  const resourceType = getResourceTypeStyles();

  const getAttachmentIcon = (size) => {
    if (size === 'Video') {
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="#FF0000" xmlns="http://www.w3.org/2000/svg">
          <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11C4.483 20.455 12 20.455 12 20.455s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837z"/>
          <polygon points="9.545 15.568 15.818 12 9.545 8.432" fill="#FFFFFF"/>
        </svg>
      );
    }
    if (size === 'Google Drive File') {
      return (
        <svg viewBox="0 0 360 360" className="w-3.5 h-3.5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M124.516 60.003L49.196 190.457L114.516 303.543L189.836 173.088L124.516 60.003Z" fill="#0066DA"/>
          <path d="M235.484 60.003H104.836L170.156 173.088H300.804L235.484 60.003Z" fill="#00AA47"/>
          <path d="M189.836 173.088L255.156 286.173L320.476 173.088H189.836Z" fill="#FFBA00"/>
        </svg>
      );
    }
    return <ExternalLink size={12} className="text-blue-400 shrink-0" />;
  };

  const isTracked = assignments.some(a => a.parentResourceId === id);

  const shouldTruncate = description && description.length > 180;
  const displayText = shouldTruncate && !isExpanded 
    ? description.substring(0, 180) + '...'
    : description;

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-5 hover:border-dark-border/80 transition-all duration-300 flex flex-col justify-between hover:shadow-lg">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-[11px] mb-2">
          <span className={`px-2 py-0.5 rounded-full font-medium flex items-center gap-1.5 ${resourceType.badge}`}>
            {resourceType.icon}
            {resourceType.label}
          </span>
          <span className="text-dark-muted flex items-center gap-1">
            <Calendar size={11} />
            {formattedDate}
          </span>
        </div>

        <h3 className="text-white font-semibold text-[15px] leading-snug">{title}</h3>

        {description && description !== title && (
          <div className="space-y-1">
            <p className="text-xs text-dark-muted whitespace-pre-line leading-relaxed break-words break-all">{displayText}</p>
            {shouldTruncate && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold focus:outline-none cursor-pointer mt-1"
              >
                {isExpanded ? 'Show Less' : 'Read More'}
              </button>
            )}
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="border-t border-dark-border/60 pt-4 mt-4 space-y-1.5">
          <span className="text-[10px] text-dark-muted font-semibold uppercase tracking-wider block mb-1">
            Attachments ({attachments.length})
          </span>
          <div className="space-y-1">
            {attachments.map((att, idx) => (
              <a
                key={idx}
                href={att.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded-lg bg-dark-sidebar border border-dark-border/40 hover:border-dark-border/80 text-[11px] text-zinc-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  {getAttachmentIcon(att.size)}
                  <span className="truncate">{att.name}</span>
                </div>
                <span className="text-[9px] text-dark-muted shrink-0 ml-2">{att.size}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-dark-border/60 pt-4 mt-4 flex items-center justify-between gap-4">
        <button
          onClick={() => isTracked ? onUntrackAssignment(id) : onTrackAsAssignment(resource)}
          className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
            isTracked 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 group' 
              : getTrackButtonStyles(courseColor, isTracked)
          }`}
        >
          {isTracked ? (
            <>
              <Check size={11} className="group-hover:hidden text-emerald-400" />
              <Trash2 size={11} className="hidden group-hover:inline text-rose-400" />
              <span className="group-hover:hidden">{t('trackedAsTask', lang)}</span>
              <span className="hidden group-hover:inline">{t('untrackTask', lang)}</span>
            </>
          ) : (
            <>
              <Pin size={11} />
              <span>{t('trackAsTask', lang)}</span>
            </>
          )}
        </button>

        {googleLink && (
          <a
            href={googleLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-brand-400 hover:text-brand-300 font-medium inline-flex items-center gap-1 shrink-0"
          >
            {t('viewOnClassroom', lang)} <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}

function CourseRow({ course, activeCount, totalAssignments, totalResources, isHidden, onSelect, onToggleVisibility, lang }) {
  const getColorDot = (color) => {
    switch (color) {
      case 'emerald': return 'bg-emerald-500';
      case 'blue': return 'bg-blue-500';
      case 'amber': return 'bg-amber-500';
      case 'rose': return 'bg-rose-500';
      case 'purple': return 'bg-purple-500';
      default: return 'bg-brand-500';
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-4 px-4 py-3.5 bg-dark-card/20 border border-dark-border/30 rounded-xl cursor-pointer transition-all duration-200 hover:border-dark-border/60 hover:bg-dark-card/40 group ${
        isHidden ? 'opacity-40 saturate-50' : ''
      }`}
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${getColorDot(course.color)}`} />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-dark-muted">{course.code}</span>
          {activeCount > 0 && !isHidden && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {activeCount} {lang === 'en' ? 'active' : 'งานค้าง'}
            </span>
          )}
          {isHidden && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {t('hiddenLabel', lang)}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-white truncate group-hover:text-brand-400 transition-colors">{course.name}</p>
      </div>

      <div className="hidden sm:flex items-center gap-4 text-[10px] text-dark-muted shrink-0">
        <span className="flex items-center gap-1"><BookOpen size={11} /> {totalAssignments}</span>
        <span className="flex items-center gap-1"><FileText size={11} /> {totalResources}</span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 text-[10px] text-dark-muted shrink-0 max-w-[140px]">
        <User size={11} className="shrink-0" />
        <span className="truncate">{course.instructor}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(course.id); }}
          className="p-1.5 rounded-lg text-dark-muted hover:text-white hover:bg-dark-hover transition-all cursor-pointer"
          title={isHidden ? t('showInDashboard', lang) : t('hideFromDashboard', lang)}
        >
          {isHidden ? <EyeOff size={13} className="text-rose-400" /> : <Eye size={13} />}
        </button>
        <ChevronRight size={14} className="text-dark-muted group-hover:text-brand-400 transition-colors" />
      </div>
    </div>
  );
}

export default function Courses() {
  const { lang } = useSettings();
  const { 
    courses, assignments, resources, hiddenCourseIds, topics,
    handleStatusChange, handleTrackAsAssignment, handleUntrackAssignment,
    handleToggleCourseVisibility, handleToggleBulkCourses
  } = useClassroom();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCourseName = searchParams.get('selected');
  const [activeTab, setActiveTab] = useState('resources');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showHidden, setShowHidden] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState('all');
  const selectedCourseObj = courses.find(c => c.name === selectedCourseName) || { color: 'blue' };
  const themeColor = selectedCourseObj.color || 'blue';

  const visibleCourses = useMemo(() => courses.filter(c => !hiddenCourseIds.includes(c.id)), [courses, hiddenCourseIds]);
  const hiddenCourses = useMemo(() => courses.filter(c => hiddenCourseIds.includes(c.id)), [courses, hiddenCourseIds]);

  const filteredVisible = useMemo(() => {
    if (!searchQuery.trim()) return visibleCourses;
    const q = searchQuery.toLowerCase();
    return visibleCourses.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.code.toLowerCase().includes(q) ||
      (c.instructor && c.instructor.toLowerCase().includes(q))
    );
  }, [visibleCourses, searchQuery]);

  const filteredHidden = useMemo(() => {
    if (!searchQuery.trim()) return hiddenCourses;
    const q = searchQuery.toLowerCase();
    return hiddenCourses.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.code.toLowerCase().includes(q) ||
      (c.instructor && c.instructor.toLowerCase().includes(q))
    );
  }, [hiddenCourses, searchQuery]);

  const getActiveCount = (courseName) => {
    return assignments.filter(a => a.course === courseName && a.status !== 'done').length;
  };

  const courseAssignments = assignments.filter((assignment) => assignment.course === selectedCourseName);
  const courseResources = resources.filter((resource) => resource.course === selectedCourseName);
  const courseTopics = topics ? topics.filter(t => t.courseId === selectedCourseObj.id) : [];

  const filterByTopic = (items) => {
    if (selectedTopicId === 'all') return items;
    if (selectedTopicId === 'none') return items.filter(item => !item.topicId);
    return items.filter(item => item.topicId === selectedTopicId);
  };

  const groupItemsByTopic = (items) => {
    const grouped = {};
    const filteredItems = filterByTopic(items);
    
    // Create 'none' group for items without topic
    grouped['none'] = filteredItems.filter(item => !item.topicId);
    
    // Group by existing topics
    courseTopics.forEach(topic => {
      const itemsInTopic = filteredItems.filter(item => item.topicId === topic.id);
      if (itemsInTopic.length > 0) {
        grouped[topic.id] = itemsInTopic;
      }
    });

    return grouped;
  };

  const renderCourseCard = (course, isHidden) => {
    const activeCount = getActiveCount(course.name);
    const totalAssignments = assignments.filter(a => a.course === course.name).length;
    const totalResources = resources.filter(r => r.course === course.name).length;

    return (
      <div
        key={course.id}
        onClick={() => setSearchParams({ selected: course.name })}
        className={`bg-dark-card/30 backdrop-blur-xl border border-white/5 rounded-3xl relative overflow-hidden flex flex-col justify-between group cursor-pointer transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 ${
          isHidden ? 'opacity-45 saturate-50' : ''
        } hover:border-${course.color}-500/30`}
      >
        <div className={`w-full h-1.5 ${getCourseBorderTopColor(course.color)}`} />
        
        <div className="p-5 md:p-6 flex-1 space-y-4">
          <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-dark-muted">
            <span className="tracking-wider uppercase">{course.code}</span>
            <div>
              {isHidden ? (
                <span className="bg-rose-500/10 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded-md">{t('hiddenLabel', lang)}</span>
              ) : activeCount > 0 ? (
                <span className={`px-2 py-0.5 rounded-md border ${getCourseBadgeColor(course.color)}`}>
                  {t('activeCount', lang, { count: activeCount })}
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-sm md:text-base font-heading text-white group-hover:text-brand-400 transition-colors leading-snug truncate" title={course.name}>
              {course.name}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] text-dark-muted font-medium">
              <span className="flex items-center gap-1"><BookOpen size={10} /> {t('assignmentsCountShort', lang, { count: totalAssignments })}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><FileText size={10} /> {t('postsMaterialsCount', lang, { count: totalResources })}</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-dark-border/20 bg-dark-sidebar/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-dark-muted min-w-0">
            <User size={12} className="shrink-0" />
            <span className="truncate">{course.instructor}</span>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleCourseVisibility(course.id);
            }}
            className="p-1.5 rounded-lg bg-dark-sidebar/40 border border-dark-border/40 text-dark-muted hover:text-white hover:bg-dark-hover transition-all duration-200 cursor-pointer"
            title={isHidden ? t('showInDashboard', lang) : t('hideFromDashboard', lang)}
          >
            {isHidden ? <EyeOff size={11} className="text-rose-400" /> : <Eye size={11} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 relative max-w-7xl mx-auto py-4">
      {/* Abstract Background Elements */}
      <div className="fixed top-0 right-1/4 w-[600px] h-[600px] ambient-glow-brand rounded-full pointer-events-none -z-10"></div>
      <div className="fixed bottom-0 left-1/4 w-[600px] h-[600px] ambient-glow-blue rounded-full pointer-events-none -z-10"></div>

      {selectedCourseName ? (
        <div className="space-y-8 opacity-0 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <button
            onClick={() => setSearchParams({})}
            className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/5 px-5 py-3 rounded-2xl cursor-pointer w-fit"
          >
            <ArrowLeft size={16} />
            {lang === 'en' ? 'Back to All Courses' : 'กลับไปที่รายวิชาทั้งหมด'}
          </button>

          {(() => {
            if (!selectedCourseObj) return null;
            return (
              <div className={`border border-white/10 bg-dark-card/40 backdrop-blur-xl rounded-3xl relative overflow-hidden p-8 md:p-10 space-y-5 shadow-2xl opacity-0 animate-fade-in`} style={{ animationDelay: '150ms' }}>
                <div className={`absolute top-0 left-0 right-0 h-2 ${getCourseBorderTopColor(selectedCourseObj.color)}`} />
                <div className="space-y-2">
                  <span className={`text-xs font-bold tracking-widest uppercase ${getCourseTextColor(selectedCourseObj.color)}`}>
                    {selectedCourseObj.code}
                  </span>
                  <h1 className="text-3xl md:text-4xl font-bold font-heading text-white tracking-tight">
                    {selectedCourseObj.name}
                  </h1>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-zinc-300">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 ${getCourseTextColor(selectedCourseObj.color)}`}>
                    <User size={16} />
                  </div>
                  <span>{t('instructorLabel', lang)} {selectedCourseObj.instructor}</span>
                </div>
              </div>
            );
          })()}

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex bg-dark-sidebar/60 border border-dark-border/40 p-1 rounded-xl w-fit gap-1 select-none">
              <button
                onClick={() => setActiveTab('resources')}
                className={`px-4.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-all duration-300 cursor-pointer ${getTabStyles(themeColor, activeTab === 'resources')}`}
              >
                <Megaphone size={13} />
                <span>{t('announcementsMaterialsTab', lang)}</span>
                <span className={`text-[10px] px-1.5 py-0.25 rounded-md border font-semibold ${getTabBadgeStyles(themeColor, activeTab === 'resources')}`}>
                  {courseResources.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('assignments')}
                className={`px-4.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-all duration-300 cursor-pointer ${getTabStyles(themeColor, activeTab === 'assignments')}`}
              >
                <BookOpen size={13} />
                <span>{t('assignmentsTab', lang)}</span>
                <span className={`text-[10px] px-1.5 py-0.25 rounded-md border font-semibold ${getTabBadgeStyles(themeColor, activeTab === 'assignments')}`}>
                  {courseAssignments.length}
                </span>
              </button>
            </div>

            <div className="flex items-center bg-dark-card border border-white/5 rounded-[20px] p-1.5 shrink-0 shadow-inner">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-2xl transition-all duration-300 ease-out cursor-pointer flex items-center justify-center ${
                  viewMode === 'grid' 
                    ? 'bg-white/10 text-brand-400 shadow-md transform scale-100' 
                    : 'text-zinc-500 hover:text-white transform scale-95 hover:scale-100'
                }`}
                title={lang === 'en' ? 'Grid view' : 'แบบตาราง'}
              >
                <LayoutGrid size={18} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-2xl transition-all duration-300 ease-out cursor-pointer flex items-center justify-center ${
                  viewMode === 'list' 
                    ? 'bg-white/10 text-brand-400 shadow-md transform scale-100' 
                    : 'text-zinc-500 hover:text-white transform scale-95 hover:scale-100'
                }`}
                title={lang === 'en' ? 'List view' : 'แบบรายการ'}
              >
                <List size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="animate-fade-in pt-4 space-y-8">
            {courseTopics.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-dark-muted px-1 uppercase tracking-wider">
                  <Filter size={14} className={`text-${themeColor}-400`} />
                  {lang === 'en' ? 'Topics' : 'หัวข้อ'}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
                  <button
                    onClick={() => setSelectedTopicId('all')}
                    className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 flex items-center gap-2 border cursor-pointer ${
                      selectedTopicId === 'all'
                        ? `bg-${themeColor}-500/20 text-${themeColor}-300 border-${themeColor}-500/30 shadow-[0_0_15px_rgba(var(--color-${themeColor}-500),0.1)]`
                        : 'bg-dark-card/50 text-dark-muted border-white/5 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <FolderOpen size={13} />
                    {lang === 'en' ? 'All' : 'ทั้งหมด'}
                  </button>
                  <button
                    onClick={() => setSelectedTopicId('none')}
                    className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 flex items-center gap-2 border cursor-pointer ${
                      selectedTopicId === 'none'
                        ? `bg-${themeColor}-500/20 text-${themeColor}-300 border-${themeColor}-500/30 shadow-[0_0_15px_rgba(var(--color-${themeColor}-500),0.1)]`
                        : 'bg-dark-card/50 text-dark-muted border-white/5 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Hash size={13} />
                    {lang === 'en' ? 'No Topic' : 'ไม่มีหัวข้อ'}
                  </button>
                  {courseTopics.map(topic => (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopicId(topic.id)}
                      className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 flex items-center gap-2 border cursor-pointer ${
                        selectedTopicId === topic.id
                          ? `bg-${themeColor}-500/20 text-${themeColor}-300 border-${themeColor}-500/30 shadow-[0_0_15px_rgba(var(--color-${themeColor}-500),0.1)]`
                          : 'bg-dark-card/50 text-dark-muted border-white/5 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Hash size={13} />
                      {topic.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'assignments' ? (
              <div className="space-y-8">
                {courseAssignments.length > 0 ? (
                  Object.entries(groupItemsByTopic(courseAssignments)).map(([topicId, items]) => {
                    if (items.length === 0) return null;
                    const topicName = topicId === 'none' 
                      ? (lang === 'en' ? 'Other Assignments' : 'งานอื่นๆ') 
                      : courseTopics.find(t => t.id === topicId)?.name || 'Unknown Topic';
                    
                    return (
                      <div key={topicId} className="space-y-4">
                        {topicId !== 'none' || courseTopics.length > 0 ? (
                          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-dark-sidebar/40 border border-white/5 border-l-4 border-l-${themeColor}-500`}>
                            <div className={`p-1.5 rounded-lg bg-${themeColor}-500/10 text-${themeColor}-400`}>
                              <Hash size={16} />
                            </div>
                            <h4 className="text-base font-bold text-white tracking-wide">{topicName}</h4>
                            <span className="text-xs font-semibold text-dark-muted bg-black/20 px-2 py-0.5 rounded-md ml-auto">
                              {items.length} {lang === 'en' ? 'Items' : 'รายการ'}
                            </span>
                          </div>
                        ) : null}
                        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" : "flex flex-col gap-4"}>
                          {items.map((assignment) => (
                            <AssignmentCard
                              key={assignment.id}
                              assignment={assignment}
                              onStatusChange={handleStatusChange}
                              lang={lang}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-dark-card/25 border border-dark-border/40 rounded-2xl p-12 text-center text-dark-muted text-xs">
                    {t('noTasksCourse', lang)}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {courseResources.length > 0 ? (
                  Object.entries(groupItemsByTopic(courseResources)).map(([topicId, items]) => {
                    if (items.length === 0) return null;
                    const topicName = topicId === 'none' 
                      ? (lang === 'en' ? 'Other Resources' : 'สื่ออื่นๆ') 
                      : courseTopics.find(t => t.id === topicId)?.name || 'Unknown Topic';
                    
                    return (
                      <div key={topicId} className="space-y-4">
                        {topicId !== 'none' || courseTopics.length > 0 ? (
                          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-dark-sidebar/40 border border-white/5 border-l-4 border-l-${themeColor}-500`}>
                            <div className={`p-1.5 rounded-lg bg-${themeColor}-500/10 text-${themeColor}-400`}>
                              <Hash size={16} />
                            </div>
                            <h4 className="text-base font-bold text-white tracking-wide">{topicName}</h4>
                            <span className="text-xs font-semibold text-dark-muted bg-black/20 px-2 py-0.5 rounded-md ml-auto">
                              {items.length} {lang === 'en' ? 'Items' : 'รายการ'}
                            </span>
                          </div>
                        ) : null}
                        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" : "flex flex-col gap-4"}>
                          {items.map((resource) => (
                            <ResourceCard
                              key={resource.id}
                              resource={resource}
                              assignments={assignments}
                              onTrackAsAssignment={handleTrackAsAssignment}
                              onUntrackAssignment={handleUntrackAssignment}
                              courseColor={themeColor}
                              lang={lang}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-dark-card/25 border border-dark-border/40 rounded-2xl p-12 text-center text-dark-muted text-xs">
                    {t('noAnnouncementsCourse', lang)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8 opacity-0 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-3xl font-bold font-heading text-white tracking-tight">{t('enrolledCoursesTitle', lang)}</h1>
              <p className="text-sm text-dark-muted mt-1 leading-relaxed">{t('enrolledCoursesDesc', lang)}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'en' ? 'Search courses by name, code, or instructor...' : 'ค้นหาวิชาจากชื่อ, รหัส หรือ อาจารย์...'}
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/5 rounded-2xl text-sm text-white placeholder-dark-muted focus:outline-none focus:border-brand-500/40 focus:bg-white/10 transition-all duration-300 shadow-sm"
                />
              </div>

              <div className="flex items-center bg-dark-card border border-white/5 rounded-[20px] p-1.5 shrink-0 shadow-inner">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-2xl transition-all duration-300 ease-out cursor-pointer flex items-center justify-center ${
                    viewMode === 'grid' 
                      ? 'bg-white/10 text-brand-400 shadow-md transform scale-100' 
                      : 'text-zinc-500 hover:text-white transform scale-95 hover:scale-100'
                  }`}
                  title={lang === 'en' ? 'Grid view' : 'แบบตาราง'}
                >
                  <LayoutGrid size={18} strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-2xl transition-all duration-300 ease-out cursor-pointer flex items-center justify-center ${
                    viewMode === 'list' 
                      ? 'bg-white/10 text-brand-400 shadow-md transform scale-100' 
                      : 'text-zinc-500 hover:text-white transform scale-95 hover:scale-100'
                  }`}
                  title={lang === 'en' ? 'List view' : 'แบบรายการ'}
                >
                  <List size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6 opacity-0 animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  {lang === 'en' ? 'Active Courses' : 'วิชาที่แสดง'}
                </h2>
                <span className="text-[10px] text-dark-muted font-medium">({filteredVisible.length})</span>
              </div>
            </div>

            {filteredVisible.length > 0 ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredVisible.map((course) => renderCourseCard(course, false))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredVisible.map((course) => (
                    <CourseRow
                      key={course.id}
                      course={course}
                      activeCount={getActiveCount(course.name)}
                      totalAssignments={assignments.filter(a => a.course === course.name).length}
                      totalResources={resources.filter(r => r.course === course.name).length}
                      isHidden={false}
                      onSelect={() => setSearchParams({ selected: course.name })}
                      onToggleVisibility={handleToggleCourseVisibility}
                      lang={lang}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="bg-dark-card/20 border border-dark-border/30 rounded-xl p-8 text-center text-dark-muted text-xs">
                {searchQuery
                  ? (lang === 'en' ? 'No courses match your search.' : 'ไม่พบวิชาที่ตรงกับคำค้นหา')
                  : (lang === 'en' ? 'No active courses.' : 'ไม่มีวิชาที่แสดง')
                }
              </div>
            )}
          </div>

          {hiddenCourses.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowHidden(!showHidden)}
                className="flex items-center gap-2 group cursor-pointer w-full"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-zinc-600 shadow-[0_0_8px_rgba(82,82,91,0.5)]" />
                  <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider group-hover:text-zinc-400 transition-colors">
                    {lang === 'en' ? 'Hidden Courses' : 'วิชาที่ซ่อน'}
                  </h2>
                  <span className="text-xs text-zinc-600 font-bold">({filteredHidden.length})</span>
                </div>
                <div className="flex-1 h-px bg-dark-border/20" />
                {showHidden ? (
                  <ChevronUp size={14} className="text-zinc-500 group-hover:text-zinc-400 transition-colors shrink-0" />
                ) : (
                  <ChevronDown size={14} className="text-zinc-500 group-hover:text-zinc-400 transition-colors shrink-0" />
                )}
              </button>

              {showHidden && (
                <div className="animate-fade-in space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleToggleBulkCourses([], false)}
                      className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Eye size={11} />
                      {t('showAll', lang)}
                    </button>
                  </div>

                  {filteredHidden.length > 0 ? (
                    viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredHidden.map((course) => renderCourseCard(course, true))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredHidden.map((course) => (
                          <CourseRow
                            key={course.id}
                            course={course}
                            activeCount={getActiveCount(course.name)}
                            totalAssignments={assignments.filter(a => a.course === course.name).length}
                            totalResources={resources.filter(r => r.course === course.name).length}
                            isHidden={true}
                            onSelect={() => setSearchParams({ selected: course.name })}
                            onToggleVisibility={handleToggleCourseVisibility}
                            lang={lang}
                          />
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="bg-dark-card/20 border border-dark-border/30 rounded-xl p-6 text-center text-dark-muted text-xs">
                      {lang === 'en' ? 'No hidden courses match your search.' : 'ไม่พบวิชาที่ซ่อนที่ตรงกับคำค้นหา'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
