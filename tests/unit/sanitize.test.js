import { describe, it, expect } from 'vitest';
import { sanitizeHtml, escapeHtml } from '../../src/utils/sanitize';

describe('sanitize utils', () => {
  describe('sanitizeHtml', () => {
    it('should remove malicious script tags', () => {
      const input = '<div>Hello <script>alert(1)</script> World</div>';
      const expected = '<div>Hello  World</div>';
      expect(sanitizeHtml(input)).toBe(expected);
    });

    it('should keep safe html tags', () => {
      const input = '<p><strong>Bold</strong> text</p>';
      expect(sanitizeHtml(input)).toBe(input);
    });
  });

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
