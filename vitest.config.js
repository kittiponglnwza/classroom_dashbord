import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/parsers/**', 'src/utils/sanitize.js', 'src/utils/result.js'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 55,
        statements: 80
      }
    }
  }
});
