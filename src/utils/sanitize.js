import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML strings to prevent XSS attacks.
 * Uses DOMPurify to strip dangerous tags like <script>, <iframe>, etc.
 * 
 * @param {string} dirtyHtml - The untrusted HTML string
 * @returns {string} Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export const sanitizeHtml = (dirtyHtml) => {
  if (!dirtyHtml) return '';
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre', 'div', 'span'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'class']
  });
};

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
