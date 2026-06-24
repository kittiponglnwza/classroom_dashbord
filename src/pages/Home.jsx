import { Link } from 'react-router-dom';
import TaskStats from '../components/TaskStats';
import AssignmentCard from '../components/AssignmentCard';
import { Calendar, ArrowRight, BookOpen, Quote } from 'lucide-react';

export default function Home({ assignments = [], onStatusChange, courses = [] }) {
  // Filter out completed and get nearest due dates
  const upcomingAssignments = assignments
    .filter(a => a.status !== 'done')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);

  // Motivational Quotes
  const quotes = [
    { text: "Productivity is being able to do things that you were never able to do before.", author: "Franz Kafka" },
    { text: "Your mind is for having ideas, not holding them.", author: "David Allen" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" }
  ];
  
  // Daily pick for quote
  const dailyQuote = quotes[new Date().getDay() % quotes.length];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-900/40 via-brand-950/20 to-dark-card border border-brand-500/20 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-heading text-white mb-2">
            Welcome back, Alex Mercer! 👋
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
          {/* Quote Card */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5 relative overflow-hidden">
            <div className="absolute -right-3 -bottom-3 text-dark-border/20">
              <Quote size={80} />
            </div>
            <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-3">Daily Inspiration</h3>
            <blockquote className="space-y-2 relative z-10">
              <p className="text-sm text-zinc-200 italic leading-relaxed">
                "{dailyQuote.text}"
              </p>
              <footer className="text-xs text-dark-muted">
                — {dailyQuote.author}
              </footer>
            </blockquote>
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
