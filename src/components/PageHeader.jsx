import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Reusable page-level header establishing consistent identity, typography,
 * optional breadcrumbs, contextual metadata, and right-aligned actions.
 */
export default function PageHeader({
  title,
  description = null,
  icon: Icon = null,
  breadcrumbs = null,
  meta = null,
  actions = null,
  className = '',
}) {
  return (
    <header
      className={`border-b border-[var(--border)] pb-3.5 sm:pb-5 ${className}`}
      data-testid="page-header"
    >
      {Array.isArray(breadcrumbs) && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]"
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5 min-w-0">
                {index > 0 && <ChevronRight size={12} className="text-[var(--text-muted)] shrink-0" aria-hidden="true" />}
                {crumb.to ? (
                  <Link
                    to={crumb.to}
                    state={crumb.state}
                    data-testid={crumb.testId}
                    className="hover:text-[var(--text-primary)] transition-colors truncate focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] rounded"
                  >
                    {crumb.label}
                  </Link>
                ) : crumb.onClick ? (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    data-testid={crumb.testId}
                    className="hover:text-[var(--text-primary)] transition-colors cursor-pointer truncate focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] rounded"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span
                    className={`truncate ${isLast ? 'text-[var(--text-secondary)] font-medium' : ''}`}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
            {Icon && (
              <Icon
                size={20}
                className="text-[var(--primary-bright)] shrink-0 sm:w-[22px] sm:h-[22px]"
                aria-hidden="true"
              />
            )}
            <h1 className="text-xl sm:text-[26px] font-[650] text-[var(--text-heading)] tracking-tight leading-tight min-w-0 break-words">
              {title}
            </h1>
            {meta}
          </div>

          {description && (
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0 self-start lg:self-auto">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
