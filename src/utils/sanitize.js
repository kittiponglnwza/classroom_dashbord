/**
 * Safely escape plain text so it can't be rendered as HTML.
 * Converts < to &lt;, > to &gt;, etc.
 * 
 * @param {string} text - The raw text
 * @returns {string} Escaped text
 */
export const escapeHtml = (text) => {
  if (text === null || text === undefined) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
};

/**
 * Only allows safe http(s) external links, rejecting javascript:, data:, vbscript:, etc.
 */
export const sanitizeExternalUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
};
