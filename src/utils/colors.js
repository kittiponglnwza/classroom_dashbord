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
    case 'emerald': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'blue': return 'bg-blue-50 text-[#0071E3] border border-blue-200';
    case 'amber': return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'rose': return 'bg-rose-50 text-rose-700 border border-rose-200';
    case 'purple': return 'bg-purple-50 text-purple-700 border border-purple-200';
    default: return 'bg-zinc-100 text-[#6E6E73] border border-[#D2D2D7]';
  }
};

export const getCourseBorderTopColor = (color) => {
  switch (color) {
    case 'emerald': return 'bg-emerald-600';
    case 'blue': return 'bg-[#0071E3]';
    case 'amber': return 'bg-amber-500';
    case 'rose': return 'bg-rose-600';
    case 'purple': return 'bg-purple-600';
    default: return 'bg-zinc-400';
  }
};

export const getCourseTextColor = (color) => {
  switch (color) {
    case 'emerald': return 'text-emerald-700';
    case 'blue': return 'text-[#0071E3]';
    case 'amber': return 'text-amber-700';
    case 'rose': return 'text-rose-700';
    case 'purple': return 'text-purple-700';
    default: return 'text-[#6E6E73]';
  }
};

export const getCourseDotClass = (color) => {
  switch (color) {
    case 'emerald': return 'bg-emerald-600';
    case 'blue': return 'bg-[#0071E3]';
    case 'amber': return 'bg-amber-500';
    case 'rose': return 'bg-rose-600';
    case 'purple': return 'bg-purple-600';
    default: return 'bg-zinc-400';
  }
};

export const getTabStyles = (_color, isActive) => {
  if (!isActive) return 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] border-transparent';
  return 'text-[#1D1D1F] bg-white shadow-xs border-[#D2D2D7]/60 font-semibold';
};

export const getTabBadgeStyles = (_color, isActive) => {
  if (!isActive) return 'bg-[#F5F5F7] text-[#6E6E73] border-[#D2D2D7]';
  return 'bg-blue-50 text-[#0071E3] border-blue-200';
};

export const getTrackButtonStyles = (_color, isTracked) => {
  if (!isTracked) return 'text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-[#D2D2D7]';
  return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
};

export const getCourseCardBorder = () => {
  return 'border-[#D2D2D7]';
};

export const getHexColor = (colorString) => {
  switch (colorString) {
    case 'emerald': return '#059669';
    case 'blue': return '#0071E3';
    case 'amber': return '#D97706';
    case 'rose': return '#E11D48';
    case 'purple': return '#7C3AED';
    default: return '#0071E3';
  }
};
