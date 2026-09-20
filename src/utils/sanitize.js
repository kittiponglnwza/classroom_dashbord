/**
 * Safely escape plain text so it can't be rendered as HTML.
 * Converts < to &lt;, > to &gt;, etc.
 * 
 * @param {string} text - The raw text
 * @returns {string} Escaped text
 */
export const escapeHtml = (text) => {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
};
