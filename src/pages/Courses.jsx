import { useSearchParams } from 'react-router-dom';
import AssignmentCard from '../components/AssignmentCard';
import { User, BookOpen, GraduationCap, ChevronRight, Eye, EyeOff } from 'lucide-react';

export default function Courses({ 
  courses = [], 
  assignments = [], 
  onStatusChange,
  hiddenCourseIds = [],
  onToggleCourseVisibility
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCourseName = searchParams.get('selected');

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

  const getActiveCount = (courseName) => {
    return assignments.filter(a => a.course === courseName && a.status !== 'done').length;
  };

  // Get filtered assignments for the selected course
  const courseAssignments = assignments.filter(
    (assignment) => assignment.course === selectedCourseName
  );

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-white">My Enrolled Courses</h1>
        <p className="text-xs text-dark-muted">Browse your academic subjects, course-specific tasks, and configure visible semesters.</p>
      </div>

      {/* Courses Grid */}
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

      {/* Selected Course Assignments */}
      {selectedCourseName && (
        <section className="space-y-4 pt-4 border-t border-dark-border/60 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                <BookOpen size={16} className="text-brand-400" />
                Tasks for {selectedCourseName}
              </h2>
              <p className="text-xs text-dark-muted">Showing {courseAssignments.length} total tasks</p>
            </div>
            <button
              onClick={() => setSearchParams({})}
              className="text-xs text-dark-muted hover:text-white transition-colors bg-dark-card border border-dark-border px-3 py-1.5 rounded-lg"
            >
              Clear Filter
            </button>
          </div>

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
            <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-dark-muted text-sm">
              No tasks found for this subject. Feel free to create one!
            </div>
          )}
        </section>
      )}
    </div>
  );
}
