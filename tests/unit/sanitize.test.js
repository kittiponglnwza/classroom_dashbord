import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../src/utils/sanitize';

describe('sanitize utils', () => {
  describe('escapeHtml', () => {
    it('should escape HTML characters', () => {
      const input = '<script>alert("XSS & hacks")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS &amp; hacks&quot;)&lt;/script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should handle undefined or null', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });
  });
});
