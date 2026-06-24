import { useState } from 'react';
import { User, ShieldAlert, Sparkles, Mail, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function Settings({ profile = {}, onProfileSave, onResetDatabase }) {
  const [name, setName] = useState(profile.name || '');
  const [studentId, setStudentId] = useState(profile.studentId || '');
  const [email, setEmail] = useState(profile.email || '');
  const [major, setMajor] = useState(profile.major || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onProfileSave({
      name,
      studentId,
      email,
      major,
      avatarUrl
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleReset = () => {
    if (confirm('⚠️ Are you sure you want to reset all classroom data to default state? This will clear all custom assignments and reset states.')) {
      onResetDatabase();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
      
      // Reload states
      window.location.reload();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-white">Hub Settings</h1>
        <p className="text-xs text-dark-muted">Modify student credentials and configure Classroom Hub backend.</p>
      </div>

      {/* Success Alerts */}
      {saveSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} />
          Profile configuration updated successfully!
        </div>
      )}

      {resetSuccess && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in">
          <RefreshCw size={16} className="animate-spin" />
          Restoring original database mock states... Page reloading.
        </div>
      )}

      {/* Profile Form Card */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-dark-border pb-4">
          <User size={18} className="text-brand-400" />
          <h3 className="font-semibold text-sm text-white">Student Profile Settings</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border border-dark-border flex-shrink-0">
              <img 
                src={avatarUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200'} 
                alt="Profile Preview" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">Avatar Image URL</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Paste avatar URL..."
                className="w-full bg-dark-sidebar border border-dark-border rounded-lg px-3.5 py-1.8 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-dark-sidebar border border-dark-border rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">Student ID</label>
              <input
                type="text"
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full bg-dark-sidebar border border-dark-border rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-dark-sidebar border border-dark-border rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">Major / Department</label>
              <input
                type="text"
                required
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className="w-full bg-dark-sidebar border border-dark-border rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs px-5 py-2.5 rounded-lg transition-colors shadow-md shadow-brand-500/10"
          >
            Save Changes
          </button>
        </form>
      </div>

      {/* Advanced Admin Configuration */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3 border-b border-dark-border pb-4">
          <ShieldAlert size={18} className="text-rose-500" />
          <h3 className="font-semibold text-sm text-white">System Administration</h3>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-dark-sidebar/40 border border-dark-border/40">
            <div>
              <h4 className="font-semibold text-xs text-white mb-1">Reset Dashboard Data</h4>
              <p className="text-[11px] text-dark-muted max-w-md">
                Clear all custom changes, restore default classroom lists, and erase temporary LocalStorage assignments.
              </p>
            </div>
            <button
              onClick={handleReset}
              className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto"
            >
              <RefreshCw size={13} />
              Reset Database
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-dark-sidebar/40 border border-dark-border/40">
            <div>
              <h4 className="font-semibold text-xs text-white mb-1">Appearance Mode</h4>
              <p className="text-[11px] text-dark-muted max-w-md">
                Classroom Hub is optimized for Dark Mode default, ensuring compliance with high-contrast guidelines.
              </p>
            </div>
            <span className="text-[10px] font-semibold border border-brand-500/25 bg-brand-500/10 text-brand-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 self-start sm:self-auto">
              <Sparkles size={12} />
              Dark Mode Default
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
