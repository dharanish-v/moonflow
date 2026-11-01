import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify('1.0.0-test') },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'build/**/*.test.ts', 'integration/**/*.test.ts'],
    // PBKDF2, axe and the sync integration tests are CPU-heavy; under load the
    // 5 s default timed out tests whose findBy* alone may wait 5 s (setup.ts).
    testTimeout: 20_000,
  },
});
