import { Link } from 'react-router-dom';
import TaskStats from '../components/TaskStats';
import AssignmentCard from '../components/AssignmentCard';
import { Calendar, ArrowRight, BookOpen, Megaphone, Clock, Paperclip } from 'lucide-react';

const courseColorStyles = {
  emerald: {
    border: 'border-l-emerald-500',
    text: 'text-emerald-400 dark:text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  blue: {
    border: 'border-l-blue-500',
    text: 'text-blue-400 dark:text-blue-400',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  amber: {
    border: 'border-l-amber-500',
    text: 'text-amber-400 dark:text-amber-400',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  rose: {
    border: 'border-l-rose-500',
    text: 'text-rose-400 dark:text-rose-400',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  purple: {
    border: 'border-l-purple-500',
    text: 'text-purple-400 dark:text-purple-400',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
};

const getStyles = (color) => {
  return courseColorStyles[color] || courseColorStyles.blue;
};

export default function Home({ 
  assignments = [], 
  onStatusChange, 
  courses = [], 
  profile = {},
  resources = [] 
}) {
  // Filter out completed and get nearest due dates
  const upcomingAssignments = assignments
    .filter(a => a.status !== 'done')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);

  // Get latest 3 announcements across all courses
  const recentAnnouncements = resources
    .filter(r => r.type === 'announcement')
    .sort((a, b) => new Date(b.creationTime) - new Date(a.creationTime))
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-900/40 via-brand-950/20 to-dark-card border border-brand-500/20 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-heading text-white mb-2">
            Welcome back, {profile.name || 'Student'}! 👋
          </h1>
          <p className="text-dark-muted text-sm max-w-xl">
            Here is your classroom hub summary. You have <span className="text-white font-semibold">{assignments.filter(a => a.status !== 'done').length} active assignments</span> waiting for your attention. Keep up the great work!
          </p>
        </div>
        <Link 
          to="/dashboard"
          className="flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition-all duration-300 shadow-md shadow-brand-500/20 self-start md:self-auto hover:translate-x-1"
        >
          Go to Dashboard
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Task Statistics */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold font-heading text-white">Your Progress Overview</h2>
        <TaskStats assignments={assignments} />
      </section>

      {/* Grid: Upcoming Tasks & Quick Quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Deadlines */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
              <Calendar size={18} className="text-brand-400" />
              Upcoming Deadlines
            </h2>
            {assignments.filter(a => a.status !== 'done').length > 3 && (
              <Link to="/dashboard" className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors flex items-center gap-1">
                View all
                <ArrowRight size={12} />
              </Link>
            )}
          </div>

          {upcomingAssignments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {upcomingAssignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          ) : (
            <div className="bg-dark-card border border-dark-border border-dashed rounded-xl p-8 text-center">
              <p className="text-dark-muted text-sm">🎉 Hooray! No upcoming deadlines. You're completely caught up!</p>
            </div>
          )}
        </div>

        {/* Motivational Widget & Course Quicklist */}
        <div className="space-y-6">
          {/* Recent Announcements Widget */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center justify-between">
              <span>Recent Announcements</span>
              <Megaphone size={14} className="text-amber-400" />
            </h3>
            
            {recentAnnouncements.length > 0 ? (
              <div className="space-y-3">
                {recentAnnouncements.map((ann) => {
                  const formattedDate = new Date(ann.creationTime).toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const styles = getStyles(ann.courseColor);

                  return (
                    <Link
                      key={ann.id}
                      to={`/courses?selected=${encodeURIComponent(ann.course)}`}
                      className={`block p-3.5 rounded-xl bg-dark-sidebar/30 border border-dark-border/40 hover:bg-dark-hover/30 hover:border-dark-border transition-all duration-300 hover:translate-x-1 group border-l-4 ${styles.border}`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border truncate max-w-[150px] ${styles.badge}`} title={ann.course}>
                            {ann.courseCode && ann.courseCode !== 'CLASSROOM' ? ann.courseCode : ann.course}
                          </span>
                          <span className="text-[10px] text-dark-muted font-medium flex items-center gap-1 shrink-0">
                            <Clock size={10} />
                            {formattedDate}
                          </span>
                        </div>
                        
                        <p className="text-xs text-zinc-100 group-hover:text-brand-400 font-semibold line-clamp-2 leading-relaxed transition-colors">
                          {ann.title}
                        </p>

                        {ann.attachments && ann.attachments.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-dark-muted pt-1 border-t border-dark-border/20 mt-1 font-medium">
                            <Paperclip size={10} className="shrink-0" />
                             <span>{ann.attachments.length} attachment{ann.attachments.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-dark-muted text-center py-4">No recent announcements at the moment.</p>
            )}
          </div>

          {/* Quick Course List */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>My Subjects</span>
              <BookOpen size={14} className="text-dark-muted" />
            </h3>
            <div className="space-y-3">
              {courses.slice(0, 4).map((c) => {
                const count = assignments.filter(a => a.course === c.name && a.status !== 'done').length;
                return (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">{c.name}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                      count > 0 ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' : 'bg-zinc-800 text-dark-muted border-zinc-700'
                    }`}>
                      {count} active
                    </span>
                  </div>
                );
              })}
              <Link 
                to="/courses"
                className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors mt-2 block text-center border-t border-dark-border pt-3"
              >
                Manage Courses
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
