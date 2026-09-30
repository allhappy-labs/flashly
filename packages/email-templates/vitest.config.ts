import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['emails/**/*.test.tsx', 'src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.react-email'],
  },
});
