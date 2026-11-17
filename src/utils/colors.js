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
    case 'emerald': return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    case 'blue': return 'bg-[#007ACC]/20 text-[#3794FF] border border-[#007ACC]/40';
    case 'amber': return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    case 'rose': return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    case 'purple': return 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
    default: return 'bg-[#2D2D2D] text-[#9D9D9D] border border-[#3C3C3C]';
  }
};

export const getCourseBorderTopColor = (color) => {
  switch (color) {
    case 'emerald': return 'bg-emerald-500';
    case 'blue': return 'bg-[#007ACC]';
    case 'amber': return 'bg-amber-500';
    case 'rose': return 'bg-rose-500';
    case 'purple': return 'bg-purple-500';
    default: return 'bg-[#858585]';
  }
};

export const getCourseTextColor = (color) => {
  switch (color) {
    case 'emerald': return 'text-emerald-400';
    case 'blue': return 'text-[#3794FF]';
    case 'amber': return 'text-amber-400';
    case 'rose': return 'text-rose-400';
    case 'purple': return 'text-purple-400';
    default: return 'text-[#9D9D9D]';
  }
};

export const getCourseDotClass = (color) => {
  switch (color) {
    case 'emerald': return 'bg-emerald-400';
    case 'blue': return 'bg-[#3794FF]';
    case 'amber': return 'bg-amber-400';
    case 'rose': return 'bg-rose-400';
    case 'purple': return 'bg-purple-400';
    default: return 'bg-[#858585]';
  }
};

export const getTabStyles = (_color, isActive) => {
  if (!isActive) return 'text-[#9D9D9D] hover:text-[#D4D4D4] hover:bg-[#2A2D2E] border-transparent';
  return 'text-[#FFFFFF] bg-[#1E1E1E] border-[#3C3C3C] font-semibold';
};

export const getTabBadgeStyles = (_color, isActive) => {
  if (!isActive) return 'bg-[#2D2D2D] text-[#9D9D9D] border-[#3C3C3C]';
  return 'bg-[#007ACC]/20 text-[#3794FF] border-[#007ACC]/40';
};

export const getTrackButtonStyles = (_color, isTracked) => {
  if (!isTracked) return 'text-[#D4D4D4] bg-[#2D2D2D] hover:bg-[#37373D] border border-[#3C3C3C]';
  return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
};

export const getCourseCardBorder = () => {
  return 'border-[#3C3C3C]';
};

export const getHexColor = (colorString) => {
  switch (colorString) {
    case 'emerald': return '#4EC9B0';
    case 'blue': return '#007ACC';
    case 'amber': return '#CCA700';
    case 'rose': return '#F14C4C';
    case 'purple': return '#C586C0';
    default: return '#007ACC';
  }
};
