import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '*.test.ts',
        '*.config.ts',
        'src/db/',
      ],
    },
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(dirname, './src') },
      { find: /^expo-sqlite$/, replacement: path.resolve(dirname, './src/__tests__/mocks/expo-sqlite.ts') },
      {
        find: /^drizzle-orm\/expo-sqlite$/,
        replacement: path.resolve(dirname, './src/__tests__/mocks/drizzle-expo-sqlite.ts'),
      },
      {
        find: /^react-native(\/.*)?$/,
        replacement: path.resolve(dirname, './src/__tests__/mocks/react-native.ts'),
      },
      {
        find: /^react-native-markdown-display$/,
        replacement: path.resolve(
          dirname,
          './src/__tests__/mocks/react-native-markdown-display.ts',
        ),
      },
      {
        find: /^expo-file-system$/,
        replacement: path.resolve(dirname, './src/__tests__/mocks/expo-file-system.ts'),
      },
      {
        find: /^expo-constants$/,
        replacement: path.resolve(dirname, './src/__tests__/mocks/expo-constants.ts'),
      },
    ],
  },
});
