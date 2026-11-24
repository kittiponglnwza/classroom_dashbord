/**
 * Reusable section heading separating second-level content groups from PageHeader.
 */
export default function SectionHeader({
  title,
  icon: Icon = null,
  dotClass = '',
  count = null,
  action = null,
  className = '',
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <h2 className="text-base font-semibold text-[var(--text-heading)] tracking-tight flex items-center gap-2 min-w-0">
        {Icon && <Icon size={16} className="text-[var(--primary-bright)] shrink-0" aria-hidden="true" />}
        {!Icon && dotClass && <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />}
        <span className="truncate">{title}</span>
        {count !== null && count !== undefined && (
          <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums shrink-0">
            ({count})
          </span>
        )}
      </h2>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
