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
  switch(color) {
    case 'emerald': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'blue': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'amber': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'rose': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    case 'purple': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    default: return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
  }
};

export const getCourseBorderTopColor = (color) => {
  switch(color) {
    case 'emerald': return 'border-t-emerald-500';
    case 'blue': return 'border-t-blue-500';
    case 'amber': return 'border-t-amber-500';
    case 'rose': return 'border-t-rose-500';
    case 'purple': return 'border-t-purple-500';
    default: return 'border-t-zinc-500';
  }
};

export const getCourseTextColor = (color) => {
  switch(color) {
    case 'emerald': return 'text-emerald-400';
    case 'blue': return 'text-blue-400';
    case 'amber': return 'text-amber-400';
    case 'rose': return 'text-rose-400';
    case 'purple': return 'text-purple-400';
    default: return 'text-zinc-400';
  }
};

export const getCourseDotClass = (color) => {
  switch(color) {
    case 'emerald': return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    case 'blue': return 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]';
    case 'amber': return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    case 'rose': return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
    case 'purple': return 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]';
    default: return 'bg-zinc-500';
  }
};

export const getTabStyles = (color, isActive) => {
  if (!isActive) return 'text-dark-muted hover:text-white hover:bg-dark-hover border-transparent';
  switch(color) {
    case 'emerald': return 'text-emerald-400 border-emerald-500 bg-emerald-500/10';
    case 'blue': return 'text-blue-400 border-blue-500 bg-blue-500/10';
    case 'amber': return 'text-amber-400 border-amber-500 bg-amber-500/10';
    case 'rose': return 'text-rose-400 border-rose-500 bg-rose-500/10';
    case 'purple': return 'text-purple-400 border-purple-500 bg-purple-500/10';
    default: return 'text-zinc-400 border-zinc-500 bg-zinc-500/10';
  }
};

export const getTabBadgeStyles = (color, isActive) => {
  if (!isActive) return 'bg-dark-hover text-dark-muted';
  switch(color) {
    case 'emerald': return 'bg-emerald-500/20 text-emerald-400';
    case 'blue': return 'bg-blue-500/20 text-blue-400';
    case 'amber': return 'bg-amber-500/20 text-amber-400';
    case 'rose': return 'bg-rose-500/20 text-rose-400';
    case 'purple': return 'bg-purple-500/20 text-purple-400';
    default: return 'bg-zinc-500/20 text-zinc-400';
  }
};

export const getTrackButtonStyles = (color, isTracked) => {
  if (!isTracked) return 'text-dark-muted hover:text-white hover:bg-dark-hover border border-dark-border';
  switch(color) {
    case 'emerald': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
    case 'blue': return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
    case 'amber': return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
    case 'rose': return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
    case 'purple': return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
    default: return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/30';
  }
};

export const getCourseCardBorder = (color) => {
  switch(color) {
    case 'emerald': return 'border-emerald-500/30';
    case 'blue': return 'border-blue-500/30';
    case 'amber': return 'border-amber-500/30';
    case 'rose': return 'border-rose-500/30';
    case 'purple': return 'border-purple-500/30';
    default: return 'border-dark-border';
  }
};

export const getHexColor = (colorString) => {
  switch (colorString) {
    case 'emerald': return '#10b981';
    case 'blue': return '#3b82f6';
    case 'amber': return '#f59e0b';
    case 'rose': return '#f43f5e';
    case 'purple': return '#a855f7';
    default: return '#10b981'; // default emerald
  }
};
