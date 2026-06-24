import { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, X, Bell, User } from 'lucide-react';

export default function Layout({ children, courses = [], assignments = [] }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-bg text-dark-text">
      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden md:block h-full">
        <Sidebar courses={courses} assignments={assignments} />
      </div>

      {/* Mobile Drawer (visible on mobile when toggled) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm">
          <div className="h-full w-64 animate-fade-in">
            <Sidebar courses={courses} assignments={assignments} />
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 text-white absolute top-4 right-4 bg-dark-card rounded-full border border-dark-border"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-dark-border bg-dark-sidebar/50 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-dark-muted hover:text-white hover:bg-dark-hover rounded-lg transition-colors border border-dark-border"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:block">
              <span className="text-xs text-dark-muted">Academic Term: 2026/Semester 2</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Stats Summary */}
            <div className="hidden lg:flex items-center gap-4 text-xs border-r border-dark-border pr-4 mr-2">
              <div className="text-right">
                <span className="text-dark-muted block">Tasks Pending</span>
                <span className="font-semibold text-brand-400">{assignments.filter(a => a.status !== 'done').length} assignments</span>
              </div>
            </div>

            {/* Notification Bell */}
            <button className="p-2 text-dark-muted hover:text-white hover:bg-dark-hover rounded-lg transition-colors border border-transparent hover:border-dark-border relative">
              <Bell size={18} />
              {assignments.filter(a => a.status === 'todo').length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>

            {/* Profile Avatar Trigger */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-dark-border">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-500/10 border border-dark-border">
                <img 
                  src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200" 
                  alt="Student Avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="hidden sm:inline text-sm font-medium text-white truncate max-w-[100px]">Alex</span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Container */}
        <main className="flex-1 overflow-y-auto bg-dark-bg p-6 md:p-8">
          <div className="max-w-7xl mx-auto w-full animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
