import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  MessageSquareText,
  X,
  Send,
  RotateCcw,
  ClipboardList,
  Calendar,
  GraduationCap,
  Clock,
  AlertCircle,
  Square,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';
import { examRepository } from '../repositories/examRepository';
import { buildWorkspaceSnapshot, sendGeminiMessage } from '../services/api/geminiApi';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';

function renderInlineSegments(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-medium text-[var(--text-heading)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-[var(--app-bg)] border border-[var(--border)] font-mono text-[12px] text-[var(--primary-bright)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function FormattedAssistantReply({ content }) {
  const lines = String(content || '').split(/\r?\n/);
  const blocks = [];
  let currentList = null;

  const flushList = () => {
    if (!currentList) return;
    blocks.push(currentList);
    currentList = null;
  };

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      flushList();
      blocks.push({ type: 'heading', key: `h-${index}`, text: headingMatch[1] });
      return;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (!currentList || currentList.listType !== 'ul') {
        flushList();
        currentList = { type: 'list', listType: 'ul', key: `ul-${index}`, items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      return;
    }

    const orderedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (orderedMatch) {
      if (!currentList || currentList.listType !== 'ol') {
        flushList();
        currentList = { type: 'list', listType: 'ol', key: `ol-${index}`, items: [] };
      }
      currentList.items.push(orderedMatch[2]);
      return;
    }

    flushList();
    blocks.push({ type: 'p', key: `p-${index}`, text: trimmed });
  });

  flushList();

  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed text-[var(--text-primary)]">
      {blocks.map((block) => {
        if (block.type === 'heading') {
          return (
            <h4 key={block.key} className="text-[13px] font-medium text-[var(--text-heading)] pt-1">
              {renderInlineSegments(block.text)}
            </h4>
          );
        }
        if (block.type === 'list') {
          const ListTag = block.listType === 'ol' ? 'ol' : 'ul';
          const listClass =
            block.listType === 'ol'
              ? 'list-decimal pl-5 space-y-1.5 marker:text-[var(--text-muted)] marker:font-mono'
              : 'list-disc pl-5 space-y-1.5 marker:text-[var(--text-muted)]';
          return (
            <ListTag key={block.key} className={listClass}>
              {block.items.map((item, i) => (
                <li key={i}>{renderInlineSegments(item)}</li>
              ))}
            </ListTag>
          );
        }
        return <p key={block.key}>{renderInlineSegments(block.text)}</p>;
      })}
    </div>
  );
}

const localizeAssistantError = (error, lang) => {
  const code = error?.code || '';
  const status = Number(error?.status || 0);

  if (code === 'MISSING_API_KEY') {
    return lang === 'en'
      ? 'GEMINI_API_KEY is not set on the server yet. Add GEMINI_API_KEY to your .env or Vercel Environment Variables.'
      : 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ที่ฝั่งเซิร์ฟเวอร์ กรุณาเพิ่มค่า GEMINI_API_KEY ในไฟล์ .env หรือในหน้าตั้งค่า Vercel';
  }
  if (code === 'UNAUTHORIZED' || status === 401) {
    return lang === 'en'
      ? 'Your Google session expired. Please reconnect Google Classroom to use Study Assistant.'
      : 'เซสชัน Google หมดอายุ กรุณากดเชื่อมต่อ Google Classroom ใหม่อีกครั้งเพื่อใช้งานผู้ช่วยการเรียน';
  }
  if (code === 'USER_DAILY_LIMIT') {
    return lang === 'en'
      ? 'You have reached today\'s Study Assistant quota. Please try again tomorrow.'
      : 'คุณใช้งานครบโควตารายวันของผู้ช่วย AI แล้ว กรุณาลองใหม่อีกครั้งในวันพรุ่งนี้';
  }
  if (code === 'USER_RPM_LIMIT' || code === 'UPSTREAM_QUOTA_EXCEEDED' || status === 429) {
    return lang === 'en'
      ? 'Too many requests right now. Please wait about a minute and try again.'
      : 'มีการเรียกใช้งานถี่เกินไปในขณะนี้ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
  }
  return lang === 'en'
    ? error?.message || 'Unable to reach Study Assistant right now.'
    : 'ไม่สามารถเชื่อมต่อกับผู้ช่วย AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
};

export default function AiAssistantDrawer({ isOpen, onClose }) {
  const { isLoggedIn = false, profile = {}, login } = useAuth() || {};
  const { lang = 'th' } = useSettings() || {};
  const { schedule = [] } = useClassroom() || {};
  const { visibleAssignments = [], visibleCourses = [] } = useClassroomUI() || {};

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [lastInteractionId, setLastInteractionId] = useState(null);

  const abortRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);

  const activeEmail = (profile?.email || '').toLowerCase().trim();

  const cachedExams = useMemo(() => {
    if (!isOpen) return [];
    const res = examRepository.getCachedExams(activeEmail);
    if (!res.success || !res.data) return [];
    return [...(res.data.exams || []), ...(res.data.manualExams || [])];
  }, [activeEmail, isOpen]);

  const pendingTaskCount = useMemo(
    () => visibleAssignments.filter((a) => a && a.status !== 'done' && a.status !== 'read').length,
    [visibleAssignments]
  );

  const activeScheduleCount = useMemo(
    () => schedule.filter((s) => s && !s.deletedAt).length,
    [schedule]
  );

  const starterPrompts = useMemo(
    () =>
      lang === 'en'
        ? [
            {
              icon: ClipboardList,
              label: 'Prioritize urgent assignments',
              prompt: 'Summarize my pending and overdue assignments sorted by urgency and tell me what to tackle first today.',
            },
            {
              icon: Calendar,
              label: 'Plan this week\'s study blocks',
              prompt: 'Look at my weekly class timetable and pending deadlines, then suggest realistic study blocks for this week.',
            },
            {
              icon: Clock,
              label: 'Today\'s classes & nearest deadlines',
              prompt: 'What classes do I have today, and which assignments are due soonest?',
            },
            {
              icon: GraduationCap,
              label: 'Build an exam prep checklist',
              prompt: 'Based on my courses and saved exam dates, create a concise exam preparation plan.',
            },
          ]
        : [
            {
              icon: ClipboardList,
              label: 'จัดลำดับงานด่วนที่ควรทำก่อน',
              prompt: 'ช่วยสรุปงานค้างและงานที่เลยกำหนดส่ง เรียงตามความเร่งด่วน พร้อมแนะนำว่าวันนี้ควรเริ่มทำชิ้นไหนก่อน',
            },
            {
              icon: Calendar,
              label: 'วางแผนแบ่งเวลาทำงานสัปดาห์นี้',
              prompt: 'ดูตารางเรียนรายสัปดาห์ควบคู่กับเดดไลน์งาน แล้วช่วยจัดตารางแบ่งเวลาเคลียร์งานและทบทวนบทเรียนให้หน่อย',
            },
            {
              icon: Clock,
              label: 'เช็คตารางเรียนวันนี้และงานใกล้ส่ง',
              prompt: 'วันนี้มีเรียนวิชาอะไรกี่โมงบ้าง และมีงานชิ้นไหนที่ใกล้ถึงกำหนดส่งที่สุด',
            },
            {
              icon: GraduationCap,
              label: 'วางแผนอ่านหนังสือเตรียมสอบ',
              prompt: 'ช่วยวางแผนอ่านหนังสือเตรียมสอบจากรายวิชาและตารางสอบที่มีอยู่ในระบบแบบกระชับทำตามได้จริง',
            },
          ],
    [lang]
  );

  useDialogFocusTrap(isOpen, dialogRef, {
    onClose,
    initialFocusRef: inputRef,
  });

  useEffect(() => {
    if (isOpen && messagesEndRef.current?.scrollIntoView) {
      const prefersReduced =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      messagesEndRef.current.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleStopRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const handleResetChat = useCallback(() => {
    handleStopRequest();
    setMessages([]);
    setLastInteractionId(null);
    setErrorBanner('');
  }, [handleStopRequest]);

  const handleSend = useCallback(
    async (overridePrompt) => {
      const textToSend = typeof overridePrompt === 'string' ? overridePrompt.trim() : inputValue.trim();
      if (!textToSend || isLoading) return;

      if (!isLoggedIn) {
        setErrorBanner(
          lang === 'en'
            ? 'Please connect Google Classroom before using Study Assistant.'
            : 'กรุณาเชื่อมต่อบัญชี Google Classroom ก่อนเริ่มใช้งานผู้ช่วย AI'
        );
        return;
      }

      setErrorBanner('');
      if (typeof overridePrompt !== 'string') {
        setInputValue('');
      }

      const userMsg = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: textToSend,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const contextSnapshot = buildWorkspaceSnapshot({
        assignments: visibleAssignments,
        courses: visibleCourses,
        schedule,
        exams: cachedExams,
        profile,
        lang,
      });

      const result = await sendGeminiMessage({
        message: textToSend,
        previousInteractionId: lastInteractionId,
        context: contextSnapshot,
        signal: controller.signal,
      });

      if (abortRef.current === controller) {
        abortRef.current = null;
      }

      if (!result.success) {
        setIsLoading(false);
        if (result.error?.name === 'AbortError') return;
        setErrorBanner(localizeAssistantError(result.error, lang));
        return;
      }

      setLastInteractionId(result.data.interactionId || null);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: result.data.reply,
        },
      ]);
      setIsLoading(false);
    },
    [
      inputValue,
      isLoading,
      isLoggedIn,
      lang,
      visibleAssignments,
      visibleCourses,
      schedule,
      cachedExams,
      profile,
      lastInteractionId,
    ]
  );

  const handleKeyDownInput = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229) {
        return;
      }
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'en' ? 'Study Assistant' : 'ผู้ช่วยวางแผนการเรียน'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-50 flex justify-end bg-black/55"
    >
      <aside className="h-full w-full sm:w-[420px] max-w-full bg-[var(--sidebar-bg)] border-l border-[var(--border-strong)] flex flex-col overflow-hidden animate-fade-in">
        {/* Drawer Header */}
        <div className="h-14 sm:h-16 px-4 border-b border-[var(--border)] bg-[var(--topbar-bg)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--primary-bright)] shrink-0">
              <MessageSquareText size={16} strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[13px] font-medium text-[var(--text-heading)] truncate">
                {lang === 'en' ? 'Study Assistant' : 'ผู้ช่วยวางแผนการเรียน'}
              </h2>
              <p className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] truncate">
                {lang === 'en'
                  ? `${pendingTaskCount} tasks · ${activeScheduleCount} classes · ${cachedExams.length} exams`
                  : `งานค้าง ${pendingTaskCount} · ตารางเรียน ${activeScheduleCount} · สอบ ${cachedExams.length}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleResetChat}
                title={lang === 'en' ? 'New conversation' : 'เริ่มบทสนทนาใหม่'}
                aria-label={lang === 'en' ? 'New conversation' : 'เริ่มบทสนทนาใหม่'}
                className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <RotateCcw size={15} strokeWidth={1.5} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={lang === 'en' ? 'Close Study Assistant' : 'ปิดผู้ช่วยการเรียน'}
              className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Conversation Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4 pt-2">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-1.5">
                <h3 className="text-[13px] font-medium text-[var(--text-heading)]">
                  {lang === 'en'
                    ? 'Ask about deadlines, classes, or exam prep'
                    : 'ถามเรื่องเดดไลน์ ตารางเรียน หรือแผนเตรียมสอบ'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {lang === 'en'
                    ? 'Answers use your synced Classroom assignments, timetable, and exam records.'
                    : 'อ้างอิงข้อมูลจริงจากงานค้างใน Classroom ตารางสอน และตารางสอบที่ซิงก์ไว้ในแอป'}
                </p>
              </div>

              {!isLoggedIn && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-[var(--text-secondary)]">
                    {lang === 'en'
                      ? 'Sign in with Google to verify your session.'
                      : 'เข้าสู่ระบบด้วย Google เพื่อเริ่มถามผู้ช่วย AI'}
                  </span>
                  <button
                    type="button"
                    onClick={() => login?.()}
                    className="min-h-11 sm:min-h-0 sm:h-8 px-3 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-medium shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-bright)]"
                  >
                    {lang === 'en' ? 'Connect' : 'เชื่อมต่อ'}
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--text-muted)] px-0.5">
                  {lang === 'en' ? 'Suggested prompts' : 'คำถามแนะนำ'}
                </p>
                <div className="space-y-2">
                  {starterPrompts.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleSend(item.prompt)}
                        className="w-full text-left p-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors flex items-center gap-3 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                          <Icon size={15} strokeWidth={1.5} />
                        </div>
                        <span className="text-xs font-medium text-[var(--text-primary)] leading-snug">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) =>
                msg.role === 'user' ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 bg-[var(--primary)] text-white text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-start">
                    <div className="w-full rounded-xl p-3.5 bg-[var(--surface)] border border-[var(--border)] break-words">
                      <FormattedAssistantReply content={msg.content} />
                    </div>
                  </div>
                )
              )}

              {isLoading && (
                <div className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--border-strong)] border-t-[var(--primary-bright)] animate-spin shrink-0" />
                    <span>{lang === 'en' ? 'Thinking...' : 'กำลังวิเคราะห์ข้อมูลตารางเรียนและงาน...'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleStopRequest}
                    className="inline-flex items-center gap-1 min-h-9 px-2 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-heading)] cursor-pointer transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    <Square size={12} strokeWidth={1.5} />
                    <span>{lang === 'en' ? 'Stop' : 'หยุด'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {errorBanner && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
            >
              <AlertCircle size={15} strokeWidth={1.5} className="shrink-0 mt-0.5 text-rose-400" />
              <span className="leading-relaxed">{errorBanner}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer Footer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-[var(--border)] bg-[var(--topbar-bg)] shrink-0"
        >
          <div className="flex items-end gap-2 bg-[var(--surface)] border border-[var(--border)] focus-within:border-[var(--border-strong)] rounded-xl p-2 transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              aria-label={
                lang === 'en'
                  ? 'Ask Study Assistant'
                  : 'พิมพ์คำถามถึงผู้ช่วยวางแผนการเรียน'
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDownInput}
              placeholder={
                lang === 'en'
                  ? 'Ask about your coursework or schedule'
                  : 'ถามเกี่ยวกับการบ้าน ตารางเรียน หรือวันสอบ'
              }
              maxLength={4000}
              className="flex-1 max-h-28 min-h-[32px] bg-transparent text-base sm:text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none px-1.5 py-1 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              aria-label={lang === 'en' ? 'Send message' : 'ส่งข้อความ'}
              className="w-11 h-11 sm:w-8 sm:h-8 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-bright)]"
            >
              <Send size={15} strokeWidth={1.5} />
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
