export const COURSE_COLOR_PALETTE = ['emerald', 'blue', 'amber', 'rose', 'purple'];

/**
 * Returns a stable color from the palette based on string (like course name or id)
 */
export const getStableColor = (str) => {
  if (!str) return COURSE_COLOR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COURSE_COLOR_PALETTE.length;
  return COURSE_COLOR_PALETTE[index];
};

export const getCourseBadgeColor = (color) => {
  switch (color) {
    case 'emerald': return 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/25';
    case 'blue': return 'bg-[var(--primary)]/15 text-[var(--primary-bright)] border border-[var(--primary)]/30';
    case 'amber': return 'bg-amber-500/12 text-amber-400 border border-amber-500/25';
    case 'rose': return 'bg-rose-500/12 text-rose-400 border border-rose-500/25';
    case 'purple': return 'bg-violet-500/12 text-violet-300 border border-violet-500/25';
    default: return 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border)]';
  }
};

export const getCourseBorderTopColor = (color) => {
  switch (color) {
    case 'emerald': return 'bg-emerald-500/80';
    case 'blue': return 'bg-[var(--primary)]';
    case 'amber': return 'bg-amber-500/80';
    case 'rose': return 'bg-rose-500/80';
    case 'purple': return 'bg-violet-500/80';
    default: return 'bg-[var(--text-muted)]';
  }
};

export const getCourseTextColor = (color) => {
  switch (color) {
    case 'emerald': return 'text-emerald-400';
    case 'blue': return 'text-[var(--primary-bright)]';
    case 'amber': return 'text-amber-400';
    case 'rose': return 'text-rose-400';
    case 'purple': return 'text-violet-300';
    default: return 'text-[var(--text-secondary)]';
  }
};

export const getCourseDotClass = (color) => {
  switch (color) {
    case 'emerald': return 'bg-emerald-400';
    case 'blue': return 'bg-[var(--primary-bright)]';
    case 'amber': return 'bg-amber-400';
    case 'rose': return 'bg-rose-400';
    case 'purple': return 'bg-violet-400';
    default: return 'bg-[var(--text-muted)]';
  }
};

export const getTabStyles = (_color, isActive) => {
  if (!isActive) return 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border-transparent';
  return 'text-[var(--text-heading)] bg-[var(--surface-elevated)] border-[var(--border-strong)] font-medium';
};

export const getTabBadgeStyles = (_color, isActive) => {
  if (!isActive) return 'bg-[var(--app-bg)] text-[var(--text-muted)] border-[var(--border)]';
  return 'bg-[var(--primary)]/15 text-[var(--primary-bright)] border-[var(--primary)]/30';
};

export const getTrackButtonStyles = (_color, isTracked) => {
  if (!isTracked) return 'text-[var(--text-primary)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)]';
  return 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/25';
};

export const getCourseCardBorder = () => {
  return 'border-[var(--border)]';
};

export const getHexColor = (colorString) => {
  switch (colorString) {
    case 'emerald': return '#4CC38A';
    case 'blue': return '#2563EB';
    case 'amber': return '#E5A93B';
    case 'rose': return '#E5484D';
    case 'purple': return '#A78BFA';
    default: return '#2563EB';
  }
};
