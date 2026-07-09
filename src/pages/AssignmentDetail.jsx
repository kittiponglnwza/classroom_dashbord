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
    <div className="space-y-6 relative">
      {downloadingFile && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-xs px-4.5 py-3 rounded-xl shadow-xl animate-fade-in">
          <span className="animate-pulse">⚡</span>
          <span>Simulating download: Starting download for "{downloadingFile}"</span>
        </div>
      )}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-xs text-dark-muted hover:text-white transition-colors bg-dark-card border border-dark-border px-3.5 py-1.8 py-2 rounded-lg self-start"
      >
        <ArrowLeft size={14} />
        {t('backDashboard', lang)}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 md:p-8 space-y-6">
            
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dark-border/60 pb-5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md bg-dark-sidebar border border-dark-border ${getCourseTextColor(courseColor)}`}>
                  {courseCode} • {course}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-dark-muted font-medium">{t('statusLabel', lang)}</span>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(id, e.target.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg bg-dark-sidebar border border-dark-border text-white cursor-pointer focus:outline-none focus:border-brand-500 font-semibold ${
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

            <div className="space-y-4">
              <h1 className="text-xl md:text-2xl font-bold font-heading text-white tracking-tight leading-snug">
                {title}
              </h1>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-dark-sidebar border border-dark-border rounded-lg p-3 flex items-center gap-3">
                  <div className="p-2 bg-dark-hover rounded-md text-brand-400">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] text-dark-muted block font-semibold uppercase">{t('dueDateLabel', lang)}</span>
                    <span className="text-xs font-medium text-zinc-200">{dueDate}</span>
                  </div>
                </div>

                <div className="bg-dark-sidebar border border-dark-border rounded-lg p-3 flex items-center gap-3">
                  <div className="p-2 bg-dark-hover rounded-md text-amber-400">
                    <Award size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] text-dark-muted block font-semibold uppercase">{t('gradeWeightLabel', lang)}</span>
                    <span className="text-xs font-medium text-zinc-200">{points} {lang === 'en' ? 'Points' : 'คะแนน'}</span>
                  </div>
                </div>

                <div className="bg-dark-sidebar border border-dark-border rounded-lg p-3 col-span-2 sm:col-span-1 flex items-center gap-3">
                  <div className="p-2 bg-dark-hover rounded-md text-zinc-400">
                    <Sparkles size={16} className={daysInfo.color} />
                  </div>
                  <div>
                    <span className="text-[10px] text-dark-muted block font-semibold uppercase">{t('countdownLabel', lang)}</span>
                    <span className={`text-xs font-semibold ${daysInfo.color}`}>{daysInfo.text}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">{t('descriptionHeader', lang)}</h3>
              <p className="text-sm text-dark-muted leading-relaxed whitespace-pre-line bg-dark-sidebar/40 border border-dark-border/40 rounded-xl p-5">
                {description || t('noDescription', lang)}
              </p>
            </div>

            {attachments && attachments.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip size={13} className="text-dark-muted" />
                  {t('attachmentsHeader', lang)}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        className="bg-dark-sidebar border border-dark-border rounded-lg p-3.5 flex items-center justify-between hover:border-brand-500/40 hover:bg-dark-hover transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileCode size={18} className="text-brand-400 flex-shrink-0" />
                          <div className="text-left overflow-hidden">
                            <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-brand-400 transition-colors">
                              {file.name}
                            </p>
                            <p className="text-[10px] text-dark-muted">{file.size}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-brand-400 border border-brand-500/20 bg-brand-500/5 px-2 py-0.5 rounded group-hover:bg-brand-500 group-hover:text-white transition-all">
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

        <div className="space-y-6">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 h-full flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-brand-400" />
                {t('workspaceHeader', lang)}
              </h3>
              <p className="text-[11px] text-dark-muted leading-relaxed">
                {t('workspaceDesc', lang)}
              </p>
              
              <div className="relative pt-2">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  onBlur={handleNotesBlur}
                  rows="14"
                  placeholder={t('workspacePlaceholder', lang)}
                  className="w-full bg-dark-sidebar border border-dark-border rounded-xl px-4 py-3.5 text-xs text-zinc-200 placeholder-dark-muted focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 transition-all font-mono resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="border-t border-dark-border/60 pt-4 mt-6 text-center">
              <p className="text-[10px] text-dark-muted flex items-center justify-center gap-1">
                <BookOpen size={10} />
                {t('savedLocally', lang)}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
