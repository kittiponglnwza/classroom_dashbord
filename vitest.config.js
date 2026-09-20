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
      include: [
        'src/services/**',
        'src/utils/**',
        'src/hooks/**',
        'src/repositories/**',
        'src/components/**',
        'src/contexts/**'
      ],
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 30,
        statements: 40
      }
    }
  }
});
