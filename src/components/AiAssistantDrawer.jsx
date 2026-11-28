import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Minus,
  Send,
  RotateCcw,
  AlertCircle,
  Square,
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';
import { examRepository } from '../repositories/examRepository';
import { buildWorkspaceSnapshot, sendGeminiMessage } from '../services/api/geminiApi';

function AssistantAvatar({ size = 'md', showStatus = false }) {
  const dimClass =
    size === 'lg'
      ? 'w-14 h-14'
      : size === 'sm'
        ? 'w-7 h-7'
        : 'w-9 h-9';
  const imgClass =
    size === 'lg'
      ? 'w-8 h-8'
      : size === 'sm'
        ? 'w-4 h-4'
        : 'w-5 h-5';

  return (
    <div className={`relative ${dimClass} rounded-full bg-[var(--surface-elevated)] border border-[var(--border-strong)] flex items-center justify-center shrink-0 select-none`}>
      <img src="/Logo.svg" alt="Study Assistant" className={`${imgClass} rounded select-none`} />
      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 ${
            size === 'lg' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'
          } rounded-full bg-[#31A24C] ring-2 ring-[#12151E]`}
        />
      )}
    </div>
  );
}

function renderInlineSegments(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-medium text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded-md bg-black/30 border border-white/10 font-mono text-[12px] text-[#7CC4FA]"
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
    <div className="space-y-2 text-[13.5px] leading-[1.48] text-[#EEF0F5]">
      {blocks.map((block) => {
        if (block.type === 'heading') {
          return (
            <h4 key={block.key} className="text-[13.5px] font-medium text-white pt-0.5">
              {renderInlineSegments(block.text)}
            </h4>
          );
        }
        if (block.type === 'list') {
          const ListTag = block.listType === 'ol' ? 'ol' : 'ul';
          const listClass =
            block.listType === 'ol'
              ? 'list-decimal pl-4 space-y-1 marker:text-[var(--text-muted)] marker:font-mono'
              : 'list-disc pl-4 space-y-1 marker:text-[var(--text-muted)]';
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

const formatChatTime = (timestamp, lang) => {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleTimeString(lang === 'en' ? 'en-US' : 'th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

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
  const [isMinimized, setIsMinimized] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [lastInteractionId, setLastInteractionId] = useState(null);

  const abortRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
              label: 'Prioritize urgent assignments',
              prompt: 'Summarize my pending and overdue assignments sorted by urgency and tell me what to tackle first today.',
            },
            {
              label: 'Plan this week\'s study blocks',
              prompt: 'Look at my weekly class timetable and pending deadlines, then suggest realistic study blocks for this week.',
            },
            {
              label: 'Today\'s classes & nearest deadlines',
              prompt: 'What classes do I have today, and which assignments are due soonest?',
            },
            {
              label: 'Build an exam prep checklist',
              prompt: 'Based on my courses and saved exam dates, create a concise exam preparation plan.',
            },
          ]
        : [
            {
              label: 'จัดลำดับงานด่วนที่ควรทำก่อน',
              prompt: 'ช่วยสรุปงานค้างและงานที่เลยกำหนดส่ง เรียงตามความเร่งด่วน พร้อมแนะนำว่าวันนี้ควรเริ่มทำชิ้นไหนก่อน',
            },
            {
              label: 'วางแผนแบ่งเวลาทำงานสัปดาห์นี้',
              prompt: 'ดูตารางเรียนรายสัปดาห์ควบคู่กับเดดไลน์งาน แล้วช่วยจัดตารางแบ่งเวลาเคลียร์งานและทบทวนบทเรียนให้หน่อย',
            },
            {
              label: 'เช็คตารางเรียนวันนี้และงานใกล้ส่ง',
              prompt: 'วันนี้มีเรียนวิชาอะไรกี่โมงบ้าง และมีงานชิ้นไหนที่ใกล้ถึงกำหนดส่งที่สุด',
            },
            {
              label: 'วางแผนอ่านหนังสือเตรียมสอบ',
              prompt: 'ช่วยวางแผนอ่านหนังสือเตรียมสอบจากรายวิชาและตารางสอบที่มีอยู่ในระบบแบบกระชับทำตามได้จริง',
            },
          ],
    [lang]
  );

  const handleCloseDrawer = useCallback(() => {
    setIsMinimized(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCloseDrawer]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      const timer = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized && messagesEndRef.current?.scrollIntoView) {
      const prefersReduced =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      messagesEndRef.current.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
    }
  }, [messages, isLoading, isOpen, isMinimized]);

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

      const nowTs = Date.now();
      const userMsg = {
        id: `u-${nowTs}`,
        role: 'user',
        content: textToSend,
        createdAt: nowTs,
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

      const replyTs = Date.now();
      setLastInteractionId(result.data.interactionId || null);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${replyTs}`,
          role: 'assistant',
          content: result.data.reply,
          createdAt: replyTs,
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

  const summaryStatsText =
    lang === 'en'
      ? `${pendingTaskCount} tasks · ${activeScheduleCount} classes · ${cachedExams.length} exams`
      : `งานค้าง ${pendingTaskCount} · ตารางเรียน ${activeScheduleCount} · สอบ ${cachedExams.length}`;

  // Messenger-style Minimized Chat Tab (Desktop)
  if (isMinimized) {
    return (
      <div
        role="region"
        aria-label={lang === 'en' ? 'Minimized Study Assistant chat' : 'แชทผู้ช่วยการเรียนที่ย่อไว้'}
        className="fixed bottom-4 right-6 z-50 w-72 h-12 rounded-full bg-[#161A24] border border-[var(--border-strong)] shadow-[0_10px_32px_rgba(0,0,0,0.55)] px-2.5 flex items-center justify-between gap-2 animate-fade-in"
      >
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex-1 flex items-center gap-2.5 min-w-0 text-left cursor-pointer focus-visible:outline-none"
        >
          <AssistantAvatar size="sm" showStatus />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--text-heading)] truncate leading-tight">
              {lang === 'en' ? 'Study Assistant' : 'ผู้ช่วยวางแผนการเรียน'}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] truncate leading-tight">
              {isLoading
                ? lang === 'en'
                  ? 'Typing...'
                  : 'กำลังพิมพ์...'
                : lang === 'en'
                  ? 'Active now'
                  : 'กำลังใช้งาน'}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={handleCloseDrawer}
          aria-label={lang === 'en' ? 'Close Study Assistant' : 'ปิดผู้ช่วยการเรียน'}
          className="w-7 h-7 rounded-full hover:bg-white/10 text-[var(--text-secondary)] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={lang === 'en' ? 'Study Assistant' : 'ผู้ช่วยวางแผนการเรียน'}
      className="fixed inset-0 sm:inset-auto sm:bottom-4 sm:right-6 z-50 w-full h-dvh sm:w-[380px] sm:h-[560px] sm:max-h-[calc(100dvh-2rem)] bg-[#12151E] sm:rounded-2xl sm:border sm:border-[var(--border-strong)] sm:shadow-[0_16px_48px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden animate-fade-in"
    >
      {/* IG DM / Messenger Top Chat Header */}
      <header className="h-14 px-3 border-b border-white/[0.08] bg-[#161A24] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleCloseDrawer}
            aria-label={lang === 'en' ? 'Back' : 'ย้อนกลับ'}
            className="sm:hidden w-9 h-9 -ml-1 rounded-full hover:bg-white/10 flex items-center justify-center text-[var(--text-primary)] cursor-pointer shrink-0"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>

          <AssistantAvatar size="md" showStatus />

          <div className="min-w-0">
            <h2 className="text-[13.5px] font-medium text-white truncate leading-snug">
              {lang === 'en' ? 'Study Assistant' : 'ผู้ช่วยวางแผนการเรียน'}
            </h2>
            <p className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] truncate leading-snug">
              {summaryStatsText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleResetChat}
              title={lang === 'en' ? 'Reset chat' : 'ล้างแชทเริ่มใหม่'}
              aria-label={lang === 'en' ? 'New conversation' : 'เริ่มบทสนทนาใหม่'}
              className="w-8 h-8 rounded-full hover:bg-white/10 text-[var(--text-secondary)] hover:text-white flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]"
            >
              <RotateCcw size={15} strokeWidth={1.75} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            title={lang === 'en' ? 'Minimize' : 'ย่อหน้าต่างแชท'}
            aria-label={lang === 'en' ? 'Minimize chat' : 'ย่อหน้าต่างแชท'}
            className="hidden sm:flex w-8 h-8 rounded-full hover:bg-white/10 text-[var(--text-secondary)] hover:text-white items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]"
          >
            <Minus size={16} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={handleCloseDrawer}
            title={lang === 'en' ? 'Close' : 'ปิดแชท'}
            aria-label={lang === 'en' ? 'Close Study Assistant' : 'ปิดผู้ช่วยการเรียน'}
            className="w-8 h-8 rounded-full hover:bg-white/10 text-[var(--text-secondary)] hover:text-white flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]"
          >
            <X size={17} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {/* IG DM / Messenger Thread Stream */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3">
        {/* IG Direct Profile Intro Header */}
        <div className="flex flex-col items-center text-center pt-2 pb-3 px-3 space-y-2">
          <AssistantAvatar size="lg" showStatus />
          <div className="space-y-0.5">
            <h3 className="text-[15px] font-medium text-white">
              {lang === 'en' ? 'Study Assistant' : 'ผู้ช่วยวางแผนการเรียน'}
            </h3>
            <p className="text-[11.5px] text-[var(--text-muted)]">
              {lang === 'en' ? 'Classroom Hub · Synced workspace' : 'Classroom Hub · ซิงก์ข้อมูลเรียนอัตโนมัติ'}
            </p>
          </div>
        </div>

        {!isLoggedIn && (
          <div className="mx-1 rounded-2xl bg-[#1D2230] border border-white/[0.08] p-3.5 flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--text-secondary)] leading-snug">
              {lang === 'en'
                ? 'Connect Google Classroom to start chatting.'
                : 'เชื่อมต่อบัญชี Google Classroom เพื่อเริ่มแชท'}
            </span>
            <button
              type="button"
              onClick={() => login?.()}
              className="h-8 px-3.5 rounded-full bg-[#0084FF] hover:bg-[#0073E6] text-white text-xs font-medium shrink-0 transition-colors cursor-pointer"
            >
              {lang === 'en' ? 'Connect' : 'เชื่อมต่อ'}
            </button>
          </div>
        )}

        {/* Icebreaker Pills (IG DM Quick Replies when empty) */}
        {messages.length === 0 && (
          <div className="pt-2 space-y-2">
            <p className="text-[11px] text-center text-[var(--text-muted)]">
              {lang === 'en' ? 'Tap a topic to start' : 'เลือกหัวข้อเพื่อเริ่มคุย หรือพิมพ์ถามด้านล่าง'}
            </p>
            <div className="flex flex-col items-end gap-1.5 pt-1">
              {starterPrompts.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSend(item.prompt)}
                  className="max-w-[88%] text-left px-3.5 py-2 rounded-[18px] bg-[#1D2230] hover:bg-[#262D3F] border border-white/[0.09] hover:border-[#0084FF]/50 text-[12.5px] text-[#E6EAF2] transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Bubbles */}
        {messages.length > 0 && (
          <div className="space-y-1.5">
            {messages.map((msg, idx) => {
              const prevRole = idx > 0 ? messages[idx - 1].role : null;
              const nextRole = idx < messages.length - 1 ? messages[idx + 1].role : null;
              const isFirstInGroup = prevRole !== msg.role;
              const isLastInGroup = nextRole !== msg.role;

              if (msg.role === 'user') {
                const userRadius =
                  !isFirstInGroup && !isLastInGroup
                    ? 'rounded-[20px] rounded-tr-[5px] rounded-br-[5px]'
                    : !isFirstInGroup && isLastInGroup
                      ? 'rounded-[20px] rounded-tr-[5px] rounded-br-[6px]'
                      : isFirstInGroup && !isLastInGroup
                        ? 'rounded-[20px] rounded-br-[5px]'
                        : 'rounded-[20px] rounded-br-[5px]';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col items-end ${isFirstInGroup && idx > 0 ? 'pt-2' : ''}`}
                  >
                    <div
                      className={`max-w-[78%] px-3.5 py-2 bg-[#0084FF] text-white text-[13.5px] leading-[1.45] whitespace-pre-wrap break-words ${userRadius}`}
                    >
                      {msg.content}
                    </div>
                    {msg.id === lastMessage?.id && !isLoading && (
                      <span className="text-[10.5px] text-[var(--text-muted)] mt-1 pr-1 select-none">
                        {lang === 'en' ? 'Sent' : 'ส่งแล้ว'}
                        {msg.createdAt ? ` · ${formatChatTime(msg.createdAt, lang)}` : ''}
                      </span>
                    )}
                  </div>
                );
              }

              const assistantRadius =
                !isFirstInGroup && !isLastInGroup
                  ? 'rounded-[20px] rounded-tl-[5px] rounded-bl-[5px]'
                  : !isFirstInGroup && isLastInGroup
                    ? 'rounded-[20px] rounded-tl-[5px] rounded-bl-[6px]'
                    : isFirstInGroup && !isLastInGroup
                      ? 'rounded-[20px] rounded-bl-[5px]'
                      : 'rounded-[20px] rounded-bl-[5px]';

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isFirstInGroup && idx > 0 ? 'pt-2' : ''}`}
                >
                  {isLastInGroup && !isLoading ? (
                    <AssistantAvatar size="sm" />
                  ) : (
                    <div className="w-7 shrink-0" aria-hidden="true" />
                  )}

                  <div className="max-w-[84%] flex flex-col items-start">
                    <div
                      className={`px-3.5 py-2.5 bg-[#222736] border border-white/[0.07] break-words ${assistantRadius}`}
                    >
                      <FormattedAssistantReply content={msg.content} />
                    </div>
                    {isLastInGroup && msg.createdAt && (
                      <span className="text-[10.5px] text-[var(--text-muted)] mt-1 pl-1 select-none">
                        {formatChatTime(msg.createdAt, lang)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* IG / Messenger 3-Dot Typing Bubble */}
            {isLoading && (
              <div className="flex items-end gap-2 pt-1">
                <AssistantAvatar size="sm" />
                <div className="px-4 py-3 rounded-[20px] rounded-bl-[5px] bg-[#222736] border border-white/[0.07] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9AA3B5] dm-typing-dot" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9AA3B5] dm-typing-dot" style={{ animationDelay: '160ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9AA3B5] dm-typing-dot" style={{ animationDelay: '320ms' }} />
                </div>
                <button
                  type="button"
                  onClick={handleStopRequest}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[11px] font-medium text-[var(--text-secondary)] hover:text-white cursor-pointer transition-colors"
                >
                  <Square size={10} strokeWidth={2} />
                  <span>{lang === 'en' ? 'Stop' : 'หยุด'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {errorBanner && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
          >
            <AlertCircle size={15} strokeWidth={1.5} className="shrink-0 mt-0.5 text-rose-400" />
            <span className="leading-relaxed">{errorBanner}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* IG DM / Messenger Rounded-Pill Composer Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] bg-[#12151E] border-t border-white/[0.07] shrink-0"
      >
        <div className="flex items-end gap-2 rounded-[24px] bg-[#1E2330] border border-white/[0.10] focus-within:border-white/[0.22] pl-3.5 pr-1.5 py-1.5 transition-colors">
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
                ? 'Message...'
                : 'ถามเกี่ยวกับการบ้าน ตารางเรียน หรือวันสอบ'
            }
            maxLength={4000}
            className="flex-1 max-h-28 min-h-[28px] bg-transparent text-base sm:text-[13.5px] text-white placeholder:text-[var(--text-muted)] resize-none py-1 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            aria-label={lang === 'en' ? 'Send message' : 'ส่งข้อความ'}
            className="w-8 h-8 rounded-full bg-[#0084FF] hover:bg-[#0073E6] disabled:opacity-35 text-white flex items-center justify-center shrink-0 transition-all duration-150 active:scale-95 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Send size={14} strokeWidth={2} className="translate-x-[0.5px]" />
          </button>
        </div>
      </form>
    </section>
  );
}
