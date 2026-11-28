import { useState, useRef, useEffect } from 'react';
import { Link2, Eye, EyeOff, X } from 'lucide-react';
import { DiscordService } from '../services/DiscordService';

/**
 * Reusable Discord Webhook URL field that replaces wall-of-dots password masking
 * with a crisp masked token preview (`.../abcd••••••••wxyz`), reveal toggle, and clear button.
 */
export default function DiscordWebhookInput({
  id,
  value = '',
  onChange,
  lang = 'en',
  compact = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const isTh = lang === 'th';

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const trimmed = String(value || '').trim();
  const validation = DiscordService.validateWebhookUrl(trimmed);
  const maskedUrl = validation.valid ? DiscordService.maskWebhookUrl(trimmed) : '';
  const showMaskedSummary = validation.valid && !isEditing;

  const focusInput = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsEditing(true);
    timerRef.current = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select?.();
      }
    }, 0);
  };

  const handleClear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsRevealed(false);
    setIsEditing(true);
    onChange?.('');
    timerRef.current = setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div
      className={`relative flex items-center gap-2 w-full bg-[var(--app-bg)] border rounded-lg transition-colors ${
        compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
      } ${
        validation.valid
          ? 'border-[var(--border)] focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/30'
          : trimmed
            ? 'border-rose-500/45 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-500/25'
            : 'border-[var(--border)] focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/30'
      }`}
    >
      <Link2
        size={13}
        strokeWidth={1.5}
        className={`shrink-0 ${
          validation.valid
            ? 'text-[var(--success)]'
            : trimmed
              ? 'text-rose-400'
              : 'text-[var(--text-muted)]'
        }`}
        aria-hidden="true"
      />

      <div className="relative flex-1 min-w-0 flex items-center">
        {showMaskedSummary && (
          <button
            type="button"
            onClick={focusInput}
            data-testid="discord-webhook-masked-preview"
            title={isTh ? 'คลิกเพื่อแก้ไขหรือวางลิงก์ใหม่' : 'Click to edit or paste a new webhook URL'}
            className="w-full text-left text-xs font-mono text-[var(--text-primary)] truncate cursor-text py-0.5 focus:outline-none"
          >
            {isRevealed ? trimmed : maskedUrl}
          </button>
        )}

        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://discord.com/api/webhooks/123456789/abcdef..."
          value={value}
          onFocus={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setIsEditing(true);
          }}
          onBlur={() => {
            timerRef.current = setTimeout(() => setIsEditing(false), 120);
          }}
          onChange={(e) => onChange?.(e.target.value)}
          className={
            showMaskedSummary
              ? 'sr-only'
              : 'w-full bg-transparent text-base sm:text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none py-0.5'
          }
        />
      </div>

      {trimmed && (
        <div className="flex items-center gap-1 shrink-0">
          {validation.valid && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsRevealed((prev) => !prev)}
              aria-label={isRevealed ? (isTh ? 'ซ่อนลิงก์เต็ม' : 'Hide full URL') : (isTh ? 'แสดงลิงก์เต็ม' : 'Reveal full URL')}
              title={isRevealed ? (isTh ? 'ซ่อนโทเคน' : 'Mask token') : (isTh ? 'ดูลิงก์เต็ม' : 'Reveal full URL')}
              className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            aria-label={isTh ? 'ล้างลิงก์ Webhook' : 'Clear Webhook URL'}
            title={isTh ? 'ล้างลิงก์' : 'Clear'}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
