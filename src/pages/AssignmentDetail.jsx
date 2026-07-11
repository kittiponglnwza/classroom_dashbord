import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Paperclip, FileText, Sparkles, 
  FileCode, Award, BookOpen
} from 'lucide-react';
import { t } from '../utils/i18n';
import { getCourseTextColor } from '../utils/colors';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';

export default function AssignmentDetail() {
  const { lang } = useSettings();
  const { assignments, handleStatusChange, handleNotesChange } = useClassroom();
  
  const { id } = useParams();
  const navigate = useNavigate();
  const assignment = assignments.find(a => a.id === id);

  const [noteContent, setNoteContent] = useState(assignment?.notes || '');
  const [downloadingFile, setDownloadingFile] = useState('');

  useEffect(() => {
    if (assignment) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoteContent(assignment.notes || '');
    }
  }, [assignment?.notes, assignment]);

  if (!assignment) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center max-w-lg mx-auto mt-10 space-y-4">
        <h3 className="text-lg font-bold text-white font-heading">{t('detailNotFound', lang)}</h3>
        <p className="text-dark-muted text-sm">{t('detailNotFoundDesc', lang)}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors"
        >
          <ArrowLeft size={14} />
          {t('backDashboard', lang)}
        </button>
      </div>
    );
  }

  const { title, course, courseCode, dueDate, status, points, attachments, description, courseColor } = assignment;

  const handleNotesBlur = () => {
    handleNotesChange(id, noteContent);
  };

  const getDaysLeft = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(dueDate);
    due.setHours(0,0,0,0);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (status === 'done') {
      return { text: t('completed', lang), color: 'text-emerald-400' };
    }
    if (diffDays < 0) {
      return { text: t('overdueDays', lang, { days: Math.abs(diffDays) }), color: 'text-rose-400' };
    } else if (diffDays === 0) {
      return { text: lang === 'en' ? 'Due today' : 'ส่งภายในวันนี้', color: 'text-amber-400 font-semibold' };
    } else if (diffDays === 1) {
      return { text: t('dueTomorrow', lang), color: 'text-amber-400' };
    } else {
      return { text: t('daysLeft', lang, { days: diffDays }), color: 'text-dark-muted' };
    }
  };

  const daysInfo = getDaysLeft();

  const handleSimulatedDownload = (fileName) => {
    setDownloadingFile(fileName);
    setTimeout(() => {
      setDownloadingFile('');
    }, 2500);
  };

  return (
    <div className="space-y-8 relative max-w-7xl mx-auto py-4 animate-fade-in">
      {/* Abstract Background Elements */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] ambient-glow-brand rounded-full pointer-events-none -z-10"></div>
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] ambient-glow-indigo rounded-full pointer-events-none -z-10"></div>
      {downloadingFile && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-xs px-4.5 py-3 rounded-xl shadow-xl animate-fade-in">
          <span className="animate-pulse">⚡</span>
          <span>Simulating download: Starting download for "{downloadingFile}"</span>
        </div>
      )}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-all duration-300 bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 px-5 py-2.5 rounded-2xl self-start backdrop-blur-md shadow-lg"
      >
        <ArrowLeft size={16} />
        {t('backDashboard', lang)}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 lg:p-10 space-y-8 shadow-2xl hover:border-white/10 transition-all duration-500 relative overflow-hidden group">
            {/* Ambient inner glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-6 relative z-10">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-4 py-1.5 rounded-xl bg-black/20 border border-white/10 shadow-sm ${getCourseTextColor(courseColor)}`}>
                  {courseCode} • {course}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">{t('statusLabel', lang)}</span>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(id, e.target.value)}
                  className={`text-sm px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white cursor-pointer focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 font-bold shadow-sm transition-all duration-300 hover:bg-white/5 ${
                    status === 'todo' ? 'text-zinc-400' :
                    status === 'doing' ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  <option value="todo">{t('todo', lang)}</option>
                  <option value="doing">{t('doing', lang)}</option>
                  <option value="done">{t('done', lang)}</option>
                </select>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              <h1 className="text-3xl md:text-4xl font-bold font-heading text-white tracking-tight leading-snug">
                {title}
              </h1>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                <div className="bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 group/card">
                  <div className="p-3 bg-black/20 rounded-xl text-brand-400 group-hover/card:scale-110 transition-transform">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wider">{t('dueDateLabel', lang)}</span>
                    <span className="text-sm font-bold text-zinc-200">{dueDate}</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 group/card">
                  <div className="p-3 bg-black/20 rounded-xl text-amber-400 group-hover/card:scale-110 transition-transform">
                    <Award size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wider">{t('gradeWeightLabel', lang)}</span>
                    <span className="text-sm font-bold text-zinc-200">{points} {lang === 'en' ? 'Points' : 'คะแนน'}</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl p-4 col-span-2 sm:col-span-1 flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 group/card">
                  <div className="p-3 bg-black/20 rounded-xl text-zinc-400 group-hover/card:scale-110 transition-transform">
                    <Sparkles size={18} className={daysInfo.color} />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wider">{t('countdownLabel', lang)}</span>
                    <span className={`text-sm font-bold ${daysInfo.color}`}>{daysInfo.text}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 relative z-10">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('descriptionHeader', lang)}</h3>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line bg-black/20 border border-white/5 rounded-2xl p-6 shadow-inner">
                {description || t('noDescription', lang)}
              </p>
            </div>

            {attachments && attachments.length > 0 && (
              <div className="space-y-4 pt-4 relative z-10">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Paperclip size={16} className="text-brand-400" />
                  {t('attachmentsHeader', lang)}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {attachments.map((file, i) => {
                    const hasLink = file.link && file.link.trim() !== '';
                    return (
                      <a 
                        key={i} 
                        href={hasLink ? file.link : '#'}
                        target={hasLink ? "_blank" : undefined}
                        rel={hasLink ? "noopener noreferrer" : undefined}
                        onClick={(e) => {
                          if (!hasLink) {
                            e.preventDefault();
                            handleSimulatedDownload(file.name);
                          }
                        }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between hover:border-brand-500/40 hover:bg-white/10 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                      >
                        <div className="flex items-center gap-4 overflow-hidden">
                          <FileCode size={20} className="text-brand-400 flex-shrink-0" />
                          <div className="text-left overflow-hidden">
                            <p className="text-sm font-bold text-zinc-200 truncate group-hover:text-brand-400 transition-colors">
                              {file.name}
                            </p>
                            <p className="text-[11px] text-zinc-500 font-medium mt-0.5">{file.size}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-brand-400 border border-brand-500/30 bg-brand-500/10 px-3 py-1 rounded-lg group-hover:bg-brand-500 group-hover:text-white transition-all uppercase tracking-wide shadow-sm">
                          {t('downloadBtn', lang)}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 lg:p-8 h-full flex flex-col justify-between shadow-2xl hover:border-white/10 transition-all duration-500 relative overflow-hidden">
            <div className="space-y-5 relative z-10">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} className="text-brand-400" />
                {t('workspaceHeader', lang)}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t('workspaceDesc', lang)}
              </p>
              
              <div className="relative pt-3">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  onBlur={handleNotesBlur}
                  rows="16"
                  placeholder={t('workspacePlaceholder', lang)}
                  className="w-full bg-black/20 border border-white/10 rounded-2xl px-5 py-4 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-300 font-mono resize-none leading-relaxed shadow-inner"
                />
              </div>
            </div>

            <div className="border-t border-white/5 pt-5 mt-8 text-center relative z-10">
              <p className="text-xs text-zinc-500 font-medium flex items-center justify-center gap-1.5">
                <BookOpen size={12} />
                {t('savedLocally', lang)}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
