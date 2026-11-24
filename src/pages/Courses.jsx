import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import AssignmentCard from '../components/AssignmentCard';
import PageHeader from '../components/PageHeader';
import SectionHeader from '../components/SectionHeader';
import {
  User, BookOpen, ChevronRight, Eye, EyeOff, ArrowLeft,
  Megaphone, FileText, ExternalLink, Calendar,
  Check, Trash2, Pin, Plus, Search, ChevronDown, ChevronUp,
  LayoutGrid, List, Hash, Filter, FolderOpen
} from 'lucide-react';
import { t } from '../utils/i18n';
import { sanitizeExternalUrl } from '../utils/sanitize';
import {
  getCourseBorderTopColor, getTabStyles,
  getTabBadgeStyles, getTrackButtonStyles, getCourseBadgeColor, getCourseDotClass
} from '../utils/colors';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';

function ResourceCard({
  resource,
  assignments = [],
  onTrackAsAssignment,
  onUntrackAssignment,
  isPinned = false,
  onTogglePin = null,
  courseColor,
  lang = 'en',
  viewMode = 'grid',
  isHighlighted = false
}) {
  const { id, title, description, type, creationTime, attachments, googleLink } = resource;
  const safeGoogleLink = sanitizeExternalUrl(googleLink);
  const [isExpanded, setIsExpanded] = useState(isHighlighted);
  const [isListExpanded, setIsListExpanded] = useState(isHighlighted);

  const formattedDate = new Date(creationTime).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
    day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
  });

  const resourceType = type === 'announcement'
    ? {
        label: t('announcementType', lang),
        badge: 'text-amber-400 bg-amber-500/15 border border-amber-500/30',
        icon: <Megaphone size={13} className="text-amber-400" />
      }
    : {
        label: t('materialType', lang),
        badge: 'text-[#3794FF] bg-[#007ACC]/20 border border-[#007ACC]/40',
        icon: <FileText size={13} className="text-[#3794FF]" />
      };

  const isTracked = assignments.some(a => a.parentResourceId === id);

  const shouldTruncate = description && description.length > 180;
  const displayText = shouldTruncate && !isExpanded
    ? description.substring(0, 180) + '...'
    : description;

  if (viewMode === 'list' && !isListExpanded) {
    return (
      <div
        onClick={() => setIsListExpanded(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsListExpanded(true);
          }
        }}
        className="group bg-[#252526] hover:bg-[#2A2D2E] border border-[#3C3C3C] rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#1E1E1E] border border-[#3C3C3C]">
            {resourceType.icon}
          </div>
          <span className="text-sm font-semibold text-[#D4D4D4] truncate group-hover:text-[#3794FF] transition-colors">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[#858585]">
            <Calendar size={12} />
            <span className="text-xs">{formattedDate}</span>
          </div>
          {onTogglePin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(id);
              }}
              aria-label={isPinned ? (lang === 'en' ? 'Unpin' : 'เลิกปักหมุด') : (lang === 'en' ? 'Pin' : 'ปักหมุด')}
              title={isPinned ? (lang === 'en' ? 'Unpin' : 'เลิกปักหมุด') : (lang === 'en' ? 'Pin to top' : 'ปักหมุดไว้บนสุด')}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isPinned
                  ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                  : 'text-[#858585] hover:text-[#D4D4D4] bg-[#1E1E1E] border-[#3C3C3C]'
              }`}
            >
              <Pin size={13} className={isPinned ? 'fill-amber-400/30' : ''} />
            </button>
          )}
          <div className="p-1 rounded-md text-[#858585] group-hover:text-[#FFFFFF] transition-colors">
            <ChevronDown size={15} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-[#252526] border rounded-2xl p-5 transition-colors flex flex-col justify-between ${
        isHighlighted
          ? 'border-[#007ACC]'
          : isPinned
            ? 'border-amber-500/35'
            : 'border-[#3C3C3C]'
      }`}
    >
      {viewMode === 'list' && (
        <div className="flex justify-between items-center -mt-1 mb-3 border-b border-[#3C3C3C] pb-2.5">
          <span className="text-xs font-medium text-[#9D9D9D]">{resourceType.label}</span>
          <button
            type="button"
            onClick={() => setIsListExpanded(false)}
            className="p-1 text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] rounded-lg transition-colors cursor-pointer"
            title={lang === 'en' ? 'Collapse' : 'ย่อ'}
          >
            <ChevronUp size={15} />
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-md font-medium flex items-center gap-1.5 ${resourceType.badge}`}>
            {resourceType.icon}
            {resourceType.label}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[#858585] flex items-center gap-1 text-[11px]">
              <Calendar size={11} />
              {formattedDate}
            </span>
            {onTogglePin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(id);
                }}
                aria-label={isPinned ? (lang === 'en' ? 'Unpin' : 'เลิกปักหมุด') : (lang === 'en' ? 'Pin' : 'ปักหมุด')}
                title={isPinned ? (lang === 'en' ? 'Unpin' : 'เลิกปักหมุด') : (lang === 'en' ? 'Pin to top' : 'ปักหมุดไว้บนสุด')}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isPinned
                    ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                    : 'text-[#858585] hover:text-[#D4D4D4] bg-[#1E1E1E] border-[#3C3C3C]'
                }`}
              >
                <Pin size={12} className={isPinned ? 'fill-amber-400/30' : ''} />
              </button>
            )}
          </div>
        </div>

        <h3 className="text-[#FFFFFF] font-semibold text-sm leading-snug">{title}</h3>

        {description && description !== title && (
          <div className="space-y-1">
            <p className="text-xs text-[#9D9D9D] whitespace-pre-line leading-relaxed break-words">{displayText}</p>
            {shouldTruncate && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-[#3794FF] hover:underline font-medium cursor-pointer mt-1"
              >
                {isExpanded ? (lang === 'en' ? 'Show Less' : 'ย่อข้อความ') : (lang === 'en' ? 'Read More' : 'อ่านเพิ่มเติม')}
              </button>
            )}
          </div>
        )}
      </div>

      {attachments && attachments.length > 0 && (
        <div className="border-t border-[#3C3C3C] pt-3.5 mt-4 space-y-1.5">
          <span className="text-[11px] text-[#858585] font-medium block mb-1">
            {lang === 'en' ? `Attachments (${attachments.length})` : `ไฟล์แนบ (${attachments.length})`}
          </span>
          <div className="space-y-1.5">
            {attachments.map((att, idx) => {
              const safeAttLink = sanitizeExternalUrl(att.link);
              if (!safeAttLink) return null;
              return (
                <a
                  key={idx}
                  href={safeAttLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-xl bg-[#1E1E1E] border border-[#3C3C3C] hover:border-[#007ACC]/70 text-xs text-[#D4D4D4] transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <ExternalLink size={12} className="text-[#3794FF] shrink-0" />
                    <span className="truncate font-medium">{att.name}</span>
                  </div>
                  <span className="text-[11px] text-[#858585] shrink-0 ml-2">{att.size}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t border-[#3C3C3C] pt-3.5 mt-4 flex items-center justify-between gap-3">
        {isTracked ? (
          <div className="inline-flex items-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 overflow-hidden">
            <span className="text-xs font-medium px-3 py-1.5 text-emerald-400 inline-flex items-center gap-1.5">
              <Check size={12} />
              <span>{t('trackedAsTask', lang)}</span>
            </span>
            <button
              type="button"
              onClick={() => onUntrackAssignment(id)}
              title={t('untrackTask', lang)}
              aria-label={t('untrackTask', lang)}
              className="px-2 py-1.5 text-rose-400 hover:bg-rose-500/20 border-l border-emerald-500/30 transition-colors cursor-pointer"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onTrackAsAssignment(resource)}
            className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 ${getTrackButtonStyles(courseColor, false)}`}
          >
            <Plus size={12} />
            <span>{t('trackAsTask', lang)}</span>
          </button>
        )}

        {safeGoogleLink && (
          <a
            href={safeGoogleLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#3794FF] hover:underline font-medium inline-flex items-center gap-1 shrink-0"
          >
            <span>{t('viewOnClassroom', lang)}</span>
            <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

function CourseRow({ course, activeCount, totalAssignments, totalResources, isHidden, onSelect, onToggleVisibility, lang }) {
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`flex items-center gap-4 px-4 py-3.5 bg-[#252526] border border-[#3C3C3C] rounded-xl cursor-pointer transition-colors hover:border-[#007ACC]/70 group ${
        isHidden ? 'opacity-60' : ''
      }`}
    >
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getCourseDotClass(course.color)}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#858585]">{course.code}</span>
          {activeCount > 0 && !isHidden && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {activeCount} {lang === 'en' ? 'active' : 'งานค้าง'}
            </span>
          )}
          {isHidden && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#1E1E1E] text-[#858585] border border-[#3C3C3C]">
              {t('hiddenLabel', lang)}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-[#D4D4D4] truncate group-hover:text-[#3794FF] transition-colors">
          {course.name}
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-4 text-xs text-[#9D9D9D] shrink-0">
        <span className="flex items-center gap-1"><BookOpen size={12} /> {totalAssignments}</span>
        <span className="flex items-center gap-1"><FileText size={12} /> {totalResources}</span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 text-xs text-[#9D9D9D] shrink-0 max-w-[160px]">
        <User size={12} className="shrink-0" />
        <span className="truncate">{course.instructor}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(course.id); }}
          className="p-1.5 rounded-lg text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors cursor-pointer"
          title={isHidden ? t('showInDashboard', lang) : t('hideFromDashboard', lang)}
        >
          {isHidden ? <EyeOff size={14} className="text-rose-400" /> : <Eye size={14} />}
        </button>
        <ChevronRight size={15} className="text-[#858585] group-hover:text-[#3794FF] transition-colors" />
      </div>
    </div>
  );
}

export default function Courses() {
  const { lang } = useSettings();
  const {
    courses, assignments, resources, topics,
    handleStatusChange, handleTrackAsAssignment, handleUntrackAssignment
  } = useClassroom();

  const {
    hiddenCourseIds, handleToggleCourseVisibility, handleToggleBulkCourses,
    isItemPinned = () => false, handleTogglePinItem
  } = useClassroomUI();

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedCourseName = searchParams.get('selected');
  const activeTab = searchParams.get('tab') || 'resources';
  const selectedTopicId = searchParams.get('topic') || 'all';
  const highlightedId = searchParams.get('highlight') || '';
  const viewMode = searchParams.get('view') || 'grid';
  const searchQuery = searchParams.get('q') || '';
  const [courseSearch, setCourseSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  const updateParams = useCallback((updates, replace = true) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, val]) => {
        if (!val || (key === 'tab' && val === 'resources') || (key === 'topic' && val === 'all') || (key === 'view' && val === 'grid')) {
          next.delete(key);
        } else {
          next.set(key, val);
        }
      });
      return next;
    }, { replace });
  }, [setSearchParams]);

  const handleSelectCourse = (courseName) => {
    setSearchParams(prev => {
      const next = new URLSearchParams();
      next.set('selected', courseName);
      const currentView = prev.get('view');
      if (currentView && currentView !== 'grid') next.set('view', currentView);
      return next;
    });
  };

  const handleBackToAllCourses = () => {
    if (location.state?.from && location.state.from !== '/courses') {
      navigate(location.state.from);
      return;
    }
    setSearchParams({});
  };

  const selectedCourseObj = courses.find(c => c.name === selectedCourseName) || { color: 'blue', name: selectedCourseName, code: '', instructor: '' };
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

  const matchesCourseItem = useCallback((item, courseObj, courseName) => {
    if (courseObj?.id && item.courseId) {
      return item.courseId === courseObj.id;
    }
    return item.course === courseName;
  }, []);

  const getActiveCount = (course) => {
    return assignments.filter(a => a.status !== 'done' && a.status !== 'read' && matchesCourseItem(a, course, course.name)).length;
  };

  const courseAssignments = assignments.filter((a) => matchesCourseItem(a, selectedCourseObj, selectedCourseName));
  const courseResources = resources.filter((r) => matchesCourseItem(r, selectedCourseObj, selectedCourseName));
  const courseTopics = topics ? topics.filter(tItem => tItem.courseId === selectedCourseObj.id) : [];

  const knownTopicIds = new Set(courseTopics.map(tItem => tItem.id));

  const filterCourseItems = (items) => {
    let result = items;
    if (selectedTopicId === 'none') {
      result = result.filter(item => !item.topicId || !knownTopicIds.has(item.topicId));
    } else if (selectedTopicId !== 'all') {
      result = result.filter(item => item.topicId === selectedTopicId);
    }
    if (courseSearch.trim()) {
      const q = courseSearch.toLowerCase();
      result = result.filter(item =>
        String(item.title || '').toLowerCase().includes(q) ||
        String(item.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  };

  const groupItemsByTopic = (items) => {
    const grouped = {};
    const filteredItems = filterCourseItems(items);
    grouped['none'] = filteredItems.filter(item => !item.topicId || !knownTopicIds.has(item.topicId));

    courseTopics.forEach(topic => {
      const itemsInTopic = filteredItems.filter(item => item.topicId === topic.id);
      if (itemsInTopic.length > 0) {
        grouped[topic.id] = itemsInTopic;
      }
    });

    return grouped;
  };

  const renderCourseCard = (course, isHidden) => {
    const activeCount = getActiveCount(course);
    const totalAssignments = assignments.filter(a => matchesCourseItem(a, course, course.name)).length;
    const totalResources = resources.filter(r => matchesCourseItem(r, course, course.name)).length;

    return (
      <div
        key={course.id}
        onClick={() => handleSelectCourse(course.name)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelectCourse(course.name);
          }
        }}
        className={`bg-[#252526] border border-[#3C3C3C] hover:border-[#007ACC]/70 rounded-2xl relative overflow-hidden flex flex-col justify-between group cursor-pointer transition-colors ${
          isHidden ? 'opacity-60' : ''
        }`}
      >
        <div className={`w-full h-1.5 ${getCourseBorderTopColor(course.color)}`} />

        <div className="p-5 flex-1 space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#858585]">
            <span>{course.code}</span>
            <div>
              {isHidden ? (
                <span className="bg-[#1E1E1E] text-[#858585] border border-[#3C3C3C] px-2 py-0.5 rounded-md text-[11px]">
                  {t('hiddenLabel', lang)}
                </span>
              ) : activeCount > 0 ? (
                <span className={`px-2 py-0.5 rounded-md text-[11px] ${getCourseBadgeColor(course.color)}`}>
                  {t('activeCount', lang, { count: activeCount })}
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-base text-[#FFFFFF] group-hover:text-[#3794FF] transition-colors leading-snug truncate" title={course.name}>
              {course.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-[#9D9D9D]">
              <span className="flex items-center gap-1"><BookOpen size={12} /> {t('assignmentsCountShort', lang, { count: totalAssignments })}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><FileText size={12} /> {t('postsMaterialsCount', lang, { count: totalResources })}</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#3C3C3C] bg-[#1E1E1E]/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#9D9D9D] min-w-0">
            <User size={13} className="shrink-0" />
            <span className="truncate">{course.instructor}</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleCourseVisibility(course.id);
            }}
            className="p-1.5 rounded-lg bg-[#252526] border border-[#3C3C3C] text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors cursor-pointer"
            title={isHidden ? t('showInDashboard', lang) : t('hideFromDashboard', lang)}
          >
            {isHidden ? <EyeOff size={13} className="text-rose-400" /> : <Eye size={13} />}
          </button>
        </div>
      </div>
    );
  };

  const renderCourseCollection = (courseList, isHidden, emptyNode) => {
    if (courseList.length === 0) {
      return emptyNode;
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courseList.map((course) => renderCourseCard(course, isHidden))}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {courseList.map((course) => (
          <CourseRow
            key={course.id}
            course={course}
            activeCount={getActiveCount(course)}
            totalAssignments={assignments.filter(a => matchesCourseItem(a, course, course.name)).length}
            totalResources={resources.filter(r => matchesCourseItem(r, course, course.name)).length}
            isHidden={isHidden}
            onSelect={() => handleSelectCourse(course.name)}
            onToggleVisibility={handleToggleCourseVisibility}
            lang={lang}
          />
        ))}
      </div>
    );
  };

  if (selectedCourseName) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: t('courses', lang), onClick: () => setSearchParams({}) },
            { label: selectedCourseObj.code || (lang === 'en' ? 'Course Details' : 'รายละเอียดรายวิชา') }
          ]}
          title={selectedCourseObj.name}
          description={
            selectedCourseObj.instructor
              ? `${t('instructorLabel', lang)} ${selectedCourseObj.instructor}`
              : undefined
          }
          icon={BookOpen}
          meta={
            selectedCourseObj.code ? (
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg ${getCourseBadgeColor(selectedCourseObj.color)}`}>
                {selectedCourseObj.code}
              </span>
            ) : null
          }
          actions={
            <>
              <button
                type="button"
                onClick={handleBackToAllCourses}
                data-testid="course-back-button"
                className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                <ArrowLeft size={14} />
                <span>
                  {location.state?.from === '/'
                    ? t('backToHome', lang)
                    : (lang === 'en' ? 'Back to All Courses' : 'กลับไปที่รายวิชาทั้งหมด')}
                </span>
              </button>

              {location.state?.from && location.state.from !== '/courses' && (
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  className="text-xs font-medium text-[var(--primary-bright)] hover:underline cursor-pointer px-2 py-1"
                >
                  {lang === 'en' ? 'View All Courses' : 'ดูรายวิชาทั้งหมด'}
                </button>
              )}
            </>
          }
        />

        <div className={`h-1 w-full rounded-full ${getCourseBorderTopColor(selectedCourseObj.color)}`} />

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex bg-[#252526] border border-[#3C3C3C] p-1 rounded-xl w-fit gap-1 select-none">
              <button
                type="button"
                onClick={() => updateParams({ tab: 'resources' })}
                className={`px-4 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer border ${getTabStyles(themeColor, activeTab === 'resources')}`}
              >
                <Megaphone size={13} />
                <span>{t('announcementsMaterialsTab', lang)}</span>
                <span className={`text-[11px] px-1.5 py-0.25 rounded-md border font-medium ${getTabBadgeStyles(themeColor, activeTab === 'resources')}`}>
                  {courseResources.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => updateParams({ tab: 'assignments' })}
                className={`px-4 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer border ${getTabStyles(themeColor, activeTab === 'assignments')}`}
              >
                <BookOpen size={13} />
                <span>{t('assignmentsTab', lang)}</span>
                <span className={`text-[11px] px-1.5 py-0.25 rounded-md border font-medium ${getTabBadgeStyles(themeColor, activeTab === 'assignments')}`}>
                  {courseAssignments.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#858585]" />
                <input
                  type="text"
                  aria-label={t('searchInCoursePlaceholder', lang)}
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder={t('searchInCoursePlaceholder', lang)}
                  className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] w-44 sm:w-56"
                />
              </div>

              <div className="flex items-center bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => updateParams({ view: 'grid' })}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                    viewMode === 'grid'
                      ? 'bg-[#094771]/70 text-[#3794FF]'
                      : 'text-[#858585] hover:text-[#D4D4D4]'
                  }`}
                  title={lang === 'en' ? 'Grid view' : 'แบบตาราง'}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => updateParams({ view: 'list' })}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                    viewMode === 'list'
                      ? 'bg-[#094771]/70 text-[#3794FF]'
                      : 'text-[#858585] hover:text-[#D4D4D4]'
                  }`}
                  title={lang === 'en' ? 'List view' : 'แบบรายการ'}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {courseTopics.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#9D9D9D] px-1">
                  <Filter size={13} className="text-[#3794FF]" />
                  <span>{lang === 'en' ? 'Topics' : 'หัวข้อ'}</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => updateParams({ topic: 'all' })}
                    className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 border cursor-pointer ${
                      selectedTopicId === 'all'
                        ? 'bg-[#007ACC] text-white border-[#007ACC]'
                        : 'bg-[#252526] text-[#9D9D9D] border-[#3C3C3C] hover:text-[#FFFFFF]'
                    }`}
                  >
                    <FolderOpen size={13} />
                    <span>{lang === 'en' ? 'All' : 'ทั้งหมด'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateParams({ topic: 'none' })}
                    className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 border cursor-pointer ${
                      selectedTopicId === 'none'
                        ? 'bg-[#007ACC] text-white border-[#007ACC]'
                        : 'bg-[#252526] text-[#9D9D9D] border-[#3C3C3C] hover:text-[#FFFFFF]'
                    }`}
                  >
                    <Hash size={13} />
                    <span>{lang === 'en' ? 'No Topic' : 'ไม่มีหัวข้อ'}</span>
                  </button>
                  {courseTopics.map(topic => (
                    <button
                      type="button"
                      key={topic.id}
                      onClick={() => updateParams({ topic: topic.id })}
                      className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 border cursor-pointer ${
                        selectedTopicId === topic.id
                          ? 'bg-[#007ACC] text-white border-[#007ACC]'
                          : 'bg-[#252526] text-[#9D9D9D] border-[#3C3C3C] hover:text-[#FFFFFF]'
                      }`}
                    >
                      <Hash size={13} />
                      <span>{topic.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'assignments' ? (() => {
              const filteredAll = filterCourseItems(courseAssignments);
              const pinnedAssignments = filteredAll.filter(item => isItemPinned(item.id));
              const unpinnedAssignments = courseAssignments.filter(item => !isItemPinned(item.id));
              const grouped = groupItemsByTopic(unpinnedAssignments);
              const hasAnyFiltered = pinnedAssignments.length > 0 || Object.values(grouped).some(arr => arr.length > 0);
              return (
                <div className="space-y-6">
                  {courseAssignments.length > 0 && hasAnyFiltered ? (
                    <>
                      {pinnedAssignments.length > 0 && (
                        <div className="space-y-3 bg-amber-500/5 border border-amber-500/25 rounded-2xl p-4">
                          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                            <Pin size={14} className="text-amber-400 fill-amber-400/30" />
                            <span>
                              {lang === 'en'
                                ? `Pinned Assignments (${pinnedAssignments.length})`
                                : `งานที่ปักหมุดไว้ (${pinnedAssignments.length})`}
                            </span>
                          </div>
                          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-3'}>
                            {pinnedAssignments.map((assignment) => (
                              <AssignmentCard
                                key={assignment.id}
                                assignment={assignment}
                                onStatusChange={handleStatusChange}
                                lang={lang}
                                viewMode={viewMode}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {Object.entries(grouped).map(([topicId, items]) => {
                        if (items.length === 0) return null;
                        const topicName = topicId === 'none'
                          ? (lang === 'en' ? 'Other Assignments' : 'งานอื่นๆ')
                          : courseTopics.find(tItem => tItem.id === topicId)?.name || 'Topic';

                        return (
                          <div key={topicId} className="space-y-3">
                            {(topicId !== 'none' || courseTopics.length > 0) && (
                              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#252526] border border-[#3C3C3C]">
                                <Hash size={15} className="text-[#3794FF]" />
                                <h4 className="text-sm font-semibold text-[#FFFFFF]">{topicName}</h4>
                                <span className="text-xs font-medium text-[#9D9D9D] bg-[#1E1E1E] px-2 py-0.5 rounded-md ml-auto border border-[#3C3C3C]">
                                  {items.length} {lang === 'en' ? 'Items' : 'รายการ'}
                                </span>
                              </div>
                            )}
                            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-3'}>
                              {items.map((assignment) => (
                                <AssignmentCard
                                  key={assignment.id}
                                  assignment={assignment}
                                  onStatusChange={handleStatusChange}
                                  lang={lang}
                                  viewMode={viewMode}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="bg-[#252526] border border-[#3C3C3C] border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center text-[#9D9D9D] text-xs gap-3">
                      <BookOpen size={28} className="text-[#858585] opacity-60" />
                      <span>
                        {courseAssignments.length > 0
                          ? (lang === 'en' ? 'No assignments match the selected topic or search.' : 'ไม่พบงานในหัวข้อหรือคำค้นหานี้')
                          : t('noTasksCourse', lang)}
                      </span>
                      {(selectedTopicId !== 'all' || courseSearch) && (
                        <button
                          type="button"
                          onClick={() => {
                            setCourseSearch('');
                            updateParams({ topic: 'all' });
                          }}
                          className="text-xs font-medium text-[#3794FF] hover:underline cursor-pointer"
                        >
                          {t('clearFilters', lang)}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })() : (() => {
              const filteredAll = filterCourseItems(courseResources);
              const pinnedResources = filteredAll.filter(item => isItemPinned(item.id));
              const unpinnedResources = courseResources.filter(item => !isItemPinned(item.id));
              const grouped = groupItemsByTopic(unpinnedResources);
              const hasAnyFiltered = pinnedResources.length > 0 || Object.values(grouped).some(arr => arr.length > 0);
              return (
                <div className="space-y-6">
                  {courseResources.length > 0 && hasAnyFiltered ? (
                    <>
                      {pinnedResources.length > 0 && (
                        <div className="space-y-3 bg-amber-500/5 border border-amber-500/25 rounded-2xl p-4">
                          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                            <Pin size={14} className="text-amber-400 fill-amber-400/30" />
                            <span>
                              {lang === 'en'
                                ? `Pinned Posts & Materials (${pinnedResources.length})`
                                : `ปักหมุดไว้ (${pinnedResources.length})`}
                            </span>
                          </div>
                          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-3'}>
                            {pinnedResources.map((resource) => (
                              <ResourceCard
                                key={resource.id}
                                resource={resource}
                                assignments={assignments}
                                onTrackAsAssignment={handleTrackAsAssignment}
                                onUntrackAssignment={handleUntrackAssignment}
                                isPinned={true}
                                onTogglePin={handleTogglePinItem}
                                courseColor={themeColor}
                                lang={lang}
                                viewMode={viewMode}
                                isHighlighted={highlightedId && String(resource.id) === String(highlightedId)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {Object.entries(grouped).map(([topicId, items]) => {
                        if (items.length === 0) return null;
                        const topicName = topicId === 'none'
                          ? (lang === 'en' ? 'Other Resources' : 'สื่ออื่นๆ')
                          : courseTopics.find(tItem => tItem.id === topicId)?.name || 'Topic';

                        return (
                          <div key={topicId} className="space-y-3">
                            {(topicId !== 'none' || courseTopics.length > 0) && (
                              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#252526] border border-[#3C3C3C]">
                                <Hash size={15} className="text-[#3794FF]" />
                                <h4 className="text-sm font-semibold text-[#FFFFFF]">{topicName}</h4>
                                <span className="text-xs font-medium text-[#9D9D9D] bg-[#1E1E1E] px-2 py-0.5 rounded-md ml-auto border border-[#3C3C3C]">
                                  {items.length} {lang === 'en' ? 'Items' : 'รายการ'}
                                </span>
                              </div>
                            )}
                            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-3'}>
                              {items.map((resource) => (
                                <ResourceCard
                                  key={resource.id}
                                  resource={resource}
                                  assignments={assignments}
                                  onTrackAsAssignment={handleTrackAsAssignment}
                                  onUntrackAssignment={handleUntrackAssignment}
                                  isPinned={isItemPinned(resource.id)}
                                  onTogglePin={handleTogglePinItem}
                                  courseColor={themeColor}
                                  lang={lang}
                                  viewMode={viewMode}
                                  isHighlighted={highlightedId && String(resource.id) === String(highlightedId)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="bg-[#252526] border border-[#3C3C3C] border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center text-[#9D9D9D] text-xs gap-3">
                      <Megaphone size={28} className="text-[#858585] opacity-60" />
                      <span>
                        {courseResources.length > 0
                          ? (lang === 'en' ? 'No posts match the selected topic or search.' : 'ไม่พบประกาศหรือเอกสารในหัวข้อหรือคำค้นหานี้')
                          : t('noAnnouncementsCourse', lang)}
                      </span>
                      {(selectedTopicId !== 'all' || courseSearch) && (
                        <button
                          type="button"
                          onClick={() => {
                            setCourseSearch('');
                            updateParams({ topic: 'all' });
                          }}
                          className="text-xs font-medium text-[#3794FF] hover:underline cursor-pointer"
                        >
                          {t('clearFilters', lang)}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('enrolledCoursesTitle', lang)}
        description={t('enrolledCoursesDesc', lang)}
        icon={BookOpen}
      />

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => updateParams({ q: e.target.value })}
            placeholder={lang === 'en' ? 'Search courses by name, code, or instructor...' : 'ค้นหาวิชาจากชื่อ, รหัส หรือ อาจารย์...'}
            className="w-full pl-9 pr-4 py-2 bg-[var(--app-bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-colors"
          />
        </div>

        <div className="flex items-center bg-[var(--app-bg)] border border-[var(--border)] rounded-xl p-0.5 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => updateParams({ view: 'grid' })}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              viewMode === 'grid'
                ? 'bg-[var(--primary-active)]/70 text-[var(--primary-bright)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title={lang === 'en' ? 'Grid view' : 'แบบตาราง'}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            type="button"
            onClick={() => updateParams({ view: 'list' })}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              viewMode === 'list'
                ? 'bg-[var(--primary-active)]/70 text-[var(--primary-bright)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title={lang === 'en' ? 'List view' : 'แบบรายการ'}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      <section className="space-y-4">
        <SectionHeader
          title={lang === 'en' ? 'Active Courses' : 'วิชาที่แสดง'}
          dotClass="bg-[var(--success)]"
          count={filteredVisible.length}
        />

        {renderCourseCollection(
          filteredVisible,
          false,
          <div className="bg-[var(--surface)] border border-[var(--border)] border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center text-[var(--text-secondary)] text-xs">
            <Search size={28} className="text-[var(--text-muted)] mb-2.5 opacity-60" />
            {searchQuery
              ? (lang === 'en' ? 'No courses match your search.' : 'ไม่พบวิชาที่ตรงกับคำค้นหา')
              : (lang === 'en' ? 'No active courses.' : 'ไม่มีวิชาที่แสดง')}
          </div>
        )}
      </section>

      {hiddenCourses.length > 0 && (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowHidden(!showHidden)}
            className="flex items-center gap-2 group cursor-pointer w-full"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text-heading)] transition-colors">
                {lang === 'en' ? 'Hidden Courses' : 'วิชาที่ซ่อน'}
              </h2>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">({filteredHidden.length})</span>
            </div>
            <div className="flex-1 h-px bg-[var(--border)]" />
            {showHidden ? (
              <ChevronUp size={14} className="text-[var(--text-muted)] shrink-0" />
            ) : (
              <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" />
            )}
          </button>

          {showHidden && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleToggleBulkCourses([], false)}
                  className="text-xs font-medium text-[var(--primary-bright)] hover:underline cursor-pointer bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Eye size={12} />
                  <span>{t('showAll', lang)}</span>
                </button>
              </div>

              {renderCourseCollection(
                filteredHidden,
                true,
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 text-center text-[var(--text-secondary)] text-xs">
                  {lang === 'en' ? 'No hidden courses match your search.' : 'ไม่พบวิชาที่ซ่อนที่ตรงกับคำค้นหา'}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
