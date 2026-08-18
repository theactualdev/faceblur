import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so tests do not drag in the PWA plugin or the
// OpenCV manual chunk; the OpenCV module is mocked in the tests themselves.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
