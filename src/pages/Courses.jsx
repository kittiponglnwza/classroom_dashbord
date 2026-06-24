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

function ResourceCard({ 
  resource, 
  assignments = [], 
  onTrackAsAssignment, 
  onUntrackAssignment, 
  courseColor 
}) {
  const { id, title, description, type, creationTime, attachments, googleLink } = resource;
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedDate = new Date(creationTime).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const getResourceTypeStyles = () => {
    if (type === 'announcement') {
      return {
        label: 'ประกาศ',
        badge: 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
        icon: <Megaphone size={14} className="text-amber-400" />
      };
    } else {
      return {
        label: 'เอกสารเรียน',
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
                {isExpanded ? 'แสดงน้อยลง' : 'อ่านเพิ่มเติม'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Attachments Section */}
      {attachments.length > 0 && (
        <div className="border-t border-dark-border/60 pt-4 mt-4 space-y-1.5">
          <span className="text-[10px] text-dark-muted font-semibold uppercase tracking-wider block mb-1">
            ไฟล์แนบ ({attachments.length})
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
              <span className="group-hover:hidden">กำลังติดตามเป็นงาน</span>
              <span className="hidden group-hover:inline">ยกเลิกการติดตาม</span>
            </>
          ) : (
            <>
              <Pin size={11} />
              <span>ย้ายไปที่ต้องส่ง</span>
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
            ดูบน Classroom <ExternalLink size={10} />
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
  onTrackAsAssignment,
  onUntrackAssignment
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCourseName = searchParams.get('selected');
  const [activeTab, setActiveTab] = useState('resources');
  const selectedCourseObj = courses.find(c => c.name === selectedCourseName) || { color: 'blue' };
  const themeColor = selectedCourseObj.color || 'blue';

  // Helper to map course color to gradient styles
  const getBannerGradient = (color) => {
    switch (color) {
      case 'emerald': return 'from-emerald-950/40 to-emerald-900/10 border-emerald-500/20';
      case 'blue': return 'from-blue-950/40 to-blue-900/10 border-blue-500/20';
      case 'amber': return 'from-amber-950/40 to-amber-900/10 border-amber-500/20';
      case 'rose': return 'from-rose-950/40 to-rose-900/10 border-rose-500/20';
      case 'purple': return 'from-purple-950/40 to-purple-900/10 border-purple-500/20';
      default: return 'from-zinc-900 to-zinc-950 border-dark-border';
    }
  };

  // Helper to map active color text
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

  // Helper to map active tab styles
  const getActiveTabStyles = (color, isActive) => {
    if (!isActive) return 'text-dark-muted border-transparent hover:text-white';
    switch (color) {
      case 'emerald': return 'text-white border-emerald-500 font-semibold';
      case 'blue': return 'text-white border-blue-500 font-semibold';
      case 'amber': return 'text-white border-amber-500 font-semibold';
      case 'rose': return 'text-white border-rose-500 font-semibold';
      case 'purple': return 'text-white border-purple-500 font-semibold';
      default: return 'text-white border-brand-500 font-semibold';
    }
  };

  const getBadgeStyles = (color, isActive) => {
    if (!isActive) return 'text-dark-muted border-dark-border';
    switch (color) {
      case 'emerald': return 'text-emerald-400 border-emerald-500/35 bg-emerald-500/5';
      case 'blue': return 'text-blue-400 border-blue-500/35 bg-blue-500/5';
      case 'amber': return 'text-amber-400 border-amber-500/35 bg-amber-500/5';
      case 'rose': return 'text-rose-400 border-rose-500/35 bg-rose-500/5';
      case 'purple': return 'text-purple-400 border-purple-500/35 bg-purple-500/5';
      default: return 'text-brand-400 border-brand-500/35 bg-brand-500/5';
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
            className="flex items-center gap-1.5 text-xs text-dark-muted hover:text-white transition-colors bg-dark-card border border-dark-border px-3.5 py-2 rounded-lg cursor-pointer"
          >
            <ArrowLeft size={14} />
            Back to All Courses
          </button>

          {/* Selected Course Banner */}
          {(() => {
            const courseObj = courses.find(c => c.name === selectedCourseName);
            if (!courseObj) return null;
            return (
              <div className={`bg-gradient-to-br ${getBannerGradient(courseObj.color)} border border-dark-border/60 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl`}>
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
                  <span>Instructor: {courseObj.instructor}</span>
                </div>
              </div>
            );
          })()}

          {/* Tab Selector */}
          <div className="flex border-b border-dark-border/40 gap-6 text-sm font-medium pt-2">
            <button
              onClick={() => setActiveTab('resources')}
              className={`pb-3 px-1 border-b-2 transition-all duration-300 relative cursor-pointer font-semibold ${getActiveTabStyles(themeColor, activeTab === 'resources')}`}
            >
              <div className="flex items-center gap-2">
                <Megaphone size={16} />
                <span>ประกาศและเอกสารเรียน</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border transition-colors duration-300 ${getBadgeStyles(themeColor, activeTab === 'resources')}`}>
                  {courseResources.length}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={`pb-3 px-1 border-b-2 transition-all duration-300 relative cursor-pointer font-semibold ${getActiveTabStyles(themeColor, activeTab === 'assignments')}`}
            >
              <div className="flex items-center gap-2">
                <BookOpen size={16} />
                <span>งานที่ต้องส่ง</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border transition-colors duration-300 ${getBadgeStyles(themeColor, activeTab === 'assignments')}`}>
                  {courseAssignments.length}
                </span>
              </div>
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
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center text-dark-muted text-sm">
                    No tasks found for this subject. Feel free to create one!
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
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center text-dark-muted text-sm">
                    No announcements or materials found for this subject.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 2. All Courses Grid View (หน้ารวมการ์ดวิชาทั้งหมด) */
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold font-heading text-white">My Enrolled Courses</h1>
            <p className="text-xs text-dark-muted">Browse your academic subjects, course-specific tasks, and configure visible semesters.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const activeCount = getActiveCount(course.name);
              const isSelected = selectedCourseName === course.name;
              const isHidden = hiddenCourseIds.includes(course.id);

              return (
                <div
                  key={course.id}
                  onClick={() => setSearchParams({ selected: course.name })}
                  className={`bg-dark-card border rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl flex flex-col justify-between group ${
                    isHidden ? 'opacity-40 hover:opacity-75 saturate-50' : ''
                  } ${
                    isSelected 
                      ? `ring-2 ring-${course.color}-500/50 border-transparent bg-gradient-to-br ${getBannerGradient(course.color)}` 
                      : `border-dark-border hover:border-dark-border/80 bg-gradient-to-br from-dark-card to-dark-sidebar`
                  }`}
                >
                  {/* Card Banner area */}
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2.5 rounded-lg bg-dark-sidebar border border-dark-border text-zinc-300">
                        <GraduationCap size={20} className={getCourseTextColor(course.color)} />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Hide/Show Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent selecting the course card
                            onToggleCourseVisibility(course.id);
                          }}
                          className="p-1.5 rounded-md bg-dark-sidebar border border-dark-border text-dark-muted hover:text-white hover:bg-dark-hover transition-colors"
                          title={isHidden ? "แสดงวิชานี้ในแดชบอร์ด" : "ซ่อนวิชานี้จากแดชบอร์ด"}
                        >
                          {isHidden ? <EyeOff size={14} className="text-rose-400" /> : <Eye size={14} />}
                        </button>

                        {isHidden ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/20">
                            ซ่อนอยู่
                          </span>
                        ) : (
                          activeCount > 0 && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              course.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              course.color === 'blue' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              course.color === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              course.color === 'rose' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                              'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            }`}>
                              {activeCount} active task{activeCount > 1 ? 's' : ''}
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-dark-muted font-bold tracking-widest uppercase">
                        {course.code}
                      </span>
                      <h3 className="font-semibold text-[15px] font-heading text-white group-hover:text-brand-400 transition-colors">
                        {course.name}
                      </h3>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-3 border-t border-dark-border/50 bg-dark-sidebar/40 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-dark-muted">
                      <User size={12} />
                      <span>{course.instructor}</span>
                    </div>
                    <ChevronRight size={14} className="text-dark-muted group-hover:text-white transition-colors" />
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
