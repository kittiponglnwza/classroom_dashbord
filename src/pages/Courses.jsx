import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AssignmentCard from '../components/AssignmentCard';
import { 
  User, 
  BookOpen, 
  GraduationCap, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Megaphone, 
  FileText, 
  ExternalLink, 
  Calendar, 
  FileCode, 
  Play,
  Check,
  Trash2,
  Pin
} from 'lucide-react';
import { t } from '../utils/i18n';

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
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
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

  // Helper to render high-fidelity brand icons
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

  const getTrackButtonStyles = (color) => {
    switch (color) {
      case 'emerald': return 'text-zinc-300 hover:text-emerald-400 border-dark-border hover:border-emerald-500/20 hover:bg-emerald-500/5';
      case 'blue': return 'text-zinc-300 hover:text-blue-400 border-dark-border hover:border-blue-500/20 hover:bg-blue-500/5';
      case 'amber': return 'text-zinc-300 hover:text-amber-400 border-dark-border hover:border-amber-500/20 hover:bg-amber-500/5';
      case 'rose': return 'text-zinc-300 hover:text-rose-400 border-dark-border hover:border-rose-500/20 hover:bg-rose-500/5';
      case 'purple': return 'text-zinc-300 hover:text-purple-400 border-dark-border hover:border-purple-500/20 hover:bg-purple-500/5';
      default: return 'text-zinc-300 hover:text-brand-400 border-dark-border hover:border-brand-500/20 hover:bg-brand-500/5';
    }
  };

  const isTracked = assignments.some(a => a.parentResourceId === id);

  const shouldTruncate = description && description.length > 180;
  const displayText = shouldTruncate && !isExpanded 
    ? description.substring(0, 180) + '...'
    : description;

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-5 hover:border-dark-border/80 transition-all duration-300 flex flex-col justify-between hover:shadow-lg">
      <div className="space-y-3">
        {/* Header Tag and Date */}
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

        {/* Title */}
        <h3 className="text-white font-semibold text-[15px] leading-snug">
          {title}
        </h3>

        {/* Description */}
        {description && description !== title && (
          <div className="space-y-1">
            <p className="text-xs text-dark-muted whitespace-pre-line leading-relaxed">
              {displayText}
            </p>
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

      {/* Attachments Section */}
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

      {/* Footer Actions */}
      <div className="border-t border-dark-border/60 pt-4 mt-4 flex items-center justify-between gap-4">
        {/* Track/Untrack button */}
        <button
          onClick={() => isTracked ? onUntrackAssignment(id) : onTrackAsAssignment(resource)}
          className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
            isTracked 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 group' 
              : getTrackButtonStyles(courseColor)
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

export default function Courses({ 
  courses = [], 
  assignments = [], 
  resources = [],
  onStatusChange,
  hiddenCourseIds = [],
  onToggleCourseVisibility,
  onToggleBulkCourses,
  onTrackAsAssignment,
  onUntrackAssignment,
  lang = 'en'
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCourseName = searchParams.get('selected');
  const [activeTab, setActiveTab] = useState('resources');
  const [isManageMode, setIsManageMode] = useState(false);
  const selectedCourseObj = courses.find(c => c.name === selectedCourseName) || { color: 'blue' };
  const themeColor = selectedCourseObj.color || 'blue';

  const getCourseTextColor = (color) => {
    switch (color) {
      case 'emerald': return 'text-emerald-400';
      case 'blue': return 'text-blue-400';
      case 'amber': return 'text-amber-400';
      case 'rose': return 'text-rose-400';
      case 'purple': return 'text-purple-400';
      default: return 'text-zinc-400';
    }
  };

  const getCourseBorderTopColor = (color) => {
    switch (color) {
      case 'emerald': return 'bg-emerald-500';
      case 'blue': return 'bg-blue-500';
      case 'amber': return 'bg-amber-500';
      case 'rose': return 'bg-rose-500';
      case 'purple': return 'bg-purple-500';
      default: return 'bg-brand-500';
    }
  };

  const getTabStyles = (color, isActive) => {
    if (!isActive) return 'text-dark-muted hover:text-white border border-transparent';
    switch (color) {
      case 'emerald': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold';
      case 'blue': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold';
      case 'amber': return 'bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold';
      case 'rose': return 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold';
      case 'purple': return 'bg-purple-500/10 text-purple-400 border-purple-500/20 font-bold';
      default: return 'bg-brand-500 text-white border border-brand-500 font-bold';
    }
  };

  const getTabBadgeStyles = (color, isActive) => {
    if (!isActive) return 'border-dark-border bg-dark-sidebar/80 text-dark-muted';
    switch (color) {
      case 'emerald': return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';
      case 'blue': return 'border-blue-500/20 bg-blue-500/10 text-blue-400';
      case 'amber': return 'border-amber-500/20 bg-amber-500/10 text-amber-400';
      case 'rose': return 'border-rose-500/20 bg-rose-500/10 text-rose-400';
      case 'purple': return 'border-purple-500/20 bg-purple-500/10 text-purple-400';
      default: return 'border-brand-400/20 bg-brand-400/10 text-brand-300';
    }
  };

  const getActiveCount = (courseName) => {
    return assignments.filter(a => a.course === courseName && a.status !== 'done').length;
  };

  // Get filtered assignments for the selected course
  const courseAssignments = assignments.filter(
    (assignment) => assignment.course === selectedCourseName
  );

  // Get filtered resources (announcements / materials) for the selected course
  const courseResources = resources.filter(
    (resource) => resource.course === selectedCourseName
  );

  return (
    <div className="space-y-8">
      {selectedCourseName ? (
        /* 1. Selected Course Detailed View (หน้าห้องเรียนเฉพาะวิชา) */
        <div className="space-y-6 animate-fade-in">
          {/* Back Button */}
          <button
            onClick={() => setSearchParams({})}
            className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-dark-muted hover:text-white transition-colors bg-dark-card/30 border border-dark-border/40 px-4 py-2.5 rounded-xl cursor-pointer"
          >
            <ArrowLeft size={13} />
            {lang === 'en' ? 'Back to All Courses' : 'กลับไปที่รายวิชาทั้งหมด'}
          </button>

          {/* Selected Course Banner - Minimal Style */}
          {(() => {
            const courseObj = courses.find(c => c.name === selectedCourseName);
            if (!courseObj) return null;
            return (
              <div className={`border border-dark-border/40 bg-dark-card/20 rounded-2xl relative overflow-hidden p-6 md:p-8 space-y-4 shadow-sm`}>
                {/* Visual Accent bar */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${getCourseBorderTopColor(courseObj.color)}`} />
                <div className="space-y-1">
                  <span className={`text-[10px] font-bold tracking-widest uppercase ${getCourseTextColor(courseObj.color)}`}>
                    {courseObj.code}
                  </span>
                  <h1 className="text-xl md:text-2xl font-bold font-heading text-white">
                    {courseObj.name}
                  </h1>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <User size={14} className={getCourseTextColor(courseObj.color)} />
                  <span>{t('instructorLabel', lang)} {courseObj.instructor}</span>
                </div>
              </div>
            );
          })()}

          {/* Tab Selector - Pill shaped */}
          <div className="flex bg-dark-sidebar/60 border border-dark-border/40 p-1 rounded-xl w-fit gap-1 select-none">
            <button
              onClick={() => setActiveTab('resources')}
              className="px-4.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-all duration-300 cursor-pointer"
              style={{
                // Quick style hack to bypass the complex dynamic tab styling
              }}
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

          {/* Conditional Tab Rendering */}
          <div className="animate-fade-in pt-2">
            {activeTab === 'assignments' ? (
              /* Assignments list for this specific course */
              <div className="space-y-4">
                {courseAssignments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {courseAssignments.map((assignment) => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        onStatusChange={onStatusChange}
                        lang={lang}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-dark-card/25 border border-dark-border/40 rounded-2xl p-12 text-center text-dark-muted text-xs">
                    {t('noTasksCourse', lang)}
                  </div>
                )}
              </div>
            ) : (
              /* Announcements & Resources list for this specific course */
              <div className="space-y-4">
                {courseResources.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {courseResources.map((resource) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        assignments={assignments}
                        onTrackAsAssignment={onTrackAsAssignment}
                        onUntrackAssignment={onUntrackAssignment}
                        courseColor={themeColor}
                        lang={lang}
                      />
                    ))}
                  </div>
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
        /* 2. All Courses Grid View (หน้ารวมการ์ดวิชาทั้งหมด - Redesigned Minimal UI) */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border/40 pb-5">
            <div>
              <h1 className="text-xl font-bold font-heading text-white">{t('enrolledCoursesTitle', lang)}</h1>
              <p className="text-[11px] text-dark-muted mt-1 leading-relaxed">{t('enrolledCoursesDesc', lang)}</p>
            </div>
            
            <button
              onClick={() => setIsManageMode(!isManageMode)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                isManageMode 
                  ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' 
                  : 'bg-dark-card/30 border-dark-border/40 text-zinc-300 hover:text-white hover:border-dark-border/80'
              }`}
            >
              {isManageMode ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{isManageMode ? t('doneBtn', lang) : t('hideMultipleBtn', lang)}</span>
            </button>
          </div>

          {isManageMode && (
            <div className="bg-dark-card/10 border border-dark-border/40 rounded-2xl p-5 md:p-6 space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-dark-border/20 pb-3 gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">{t('selectToHide', lang)}</h4>
                  <p className="text-[10px] text-dark-muted">{t('selectToHideDesc', lang)}</p>
                </div>
                {/* Bulk Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const allIds = courses.map(c => c.id);
                      onToggleBulkCourses(allIds, true);
                    }}
                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 cursor-pointer bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    {t('hideAll', lang)}
                  </button>
                  <button
                    onClick={() => {
                      onToggleBulkCourses([], false);
                    }}
                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    {t('showAll', lang)}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {courses.map((course) => {
                  const isHidden = hiddenCourseIds.includes(course.id);
                  return (
                    <label 
                      key={course.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none ${
                        isHidden 
                          ? 'bg-rose-500/5 border-rose-500/10 text-rose-400/80 hover:bg-rose-500/10' 
                          : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          onChange={() => onToggleCourseVisibility(course.id)}
                          className="w-4 h-4 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0 focus:ring-offset-0"
                        />
                        <div className="truncate text-xs font-semibold text-white">
                          <span className="block text-[8px] opacity-75 uppercase text-dark-muted">{course.code}</span>
                          <span className="block truncate">{course.name}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] uppercase font-bold shrink-0 px-1.5 py-0.5 rounded border ${
                        isHidden ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {isHidden ? t('hiddenLabel', lang) : t('visibleLabel', lang)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const activeCount = getActiveCount(course.name);
              const isHidden = hiddenCourseIds.includes(course.id);
              
              const totalAssignments = assignments.filter(a => a.course === course.name).length;
              const totalResources = resources.filter(r => r.course === course.name).length;

              return (
                <div
                  key={course.id}
                  onClick={() => setSearchParams({ selected: course.name })}
                  className={`bg-dark-card/20 border border-dark-border/40 rounded-2xl relative overflow-hidden flex flex-col justify-between group cursor-pointer transition-all duration-300 hover:shadow-md hover:translate-y-[-3px] ${
                    isHidden ? 'opacity-45 saturate-50' : ''
                  }`}
                >
                  {/* Top Colored Border Strip */}
                  <div className={`w-full h-1 ${getCourseBorderTopColor(course.color)}`} />
                  
                  {/* Card Body */}
                  <div className="p-5 md:p-6 flex-1 space-y-4">
                    <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-dark-muted">
                      <span className="tracking-wider uppercase">{course.code}</span>
                      <div>
                        {isHidden ? (
                          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded-md">{t('hiddenLabel', lang)}</span>
                        ) : activeCount > 0 ? (
                          <span className={`px-2 py-0.5 rounded-md border ${
                            course.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            course.color === 'blue' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            course.color === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            course.color === 'rose' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          }`}>
                            {t('activeCount', lang, { count: activeCount })}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-sm md:text-base font-heading text-white group-hover:text-brand-400 transition-colors leading-snug">
                        {course.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[10px] text-dark-muted font-medium">
                        <span>{t('assignmentsCountShort', lang, { count: totalAssignments })}</span>
                        <span>•</span>
                        <span>{t('postsMaterialsCount', lang, { count: totalResources })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-3 border-t border-dark-border/20 bg-dark-sidebar/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-dark-muted min-w-0">
                      <User size={12} className="shrink-0" />
                      <span className="truncate">{course.instructor}</span>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent selecting the course card
                        onToggleCourseVisibility(course.id);
                      }}
                      className="p-1.5 rounded-lg bg-dark-sidebar/40 border border-dark-border/40 text-dark-muted hover:text-white hover:bg-dark-hover transition-all duration-200 cursor-pointer"
                      title={isHidden ? t('showInDashboard', lang) : t('hideFromDashboard', lang)}
                    >
                      {isHidden ? <EyeOff size={11} className="text-rose-400" /> : <Eye size={11} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
