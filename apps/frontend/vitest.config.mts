import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [
        viteReact(),
        babel({ presets: [reactCompilerPreset()] }),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(dirname, 'src'),
        },
    },
    optimizeDeps: {
        include: [
            '@storybook/react-vite',
            'better-auth/client',
            'better-auth/client/plugins',
            'i18next',
            'react-i18next',
            'storybook/test',
        ],
    },
    test: {
        alias: {
            '@': path.resolve(dirname, 'src'),
        },
        coverage: {
            exclude: [
                'node_modules',
                'dist',
                '.storybook',
                '**/*.d.ts',
                '**/*.stories.{js,jsx,ts,tsx}',
                '**/*.test.{js,jsx,ts,tsx}',
                '**/*.spec.{js,jsx,ts,tsx}',
            ], include: ['src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'], provider: 'v8', reporter: ['text', 'json', 'html'],
        }, globals: true, projects: [
            {
                extends: true,
                test: {
                    environment: 'node', exclude: ['src/**/*.stories.tsx'], include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'], name: 'unit',
                },
            },
            {
                extends: true,
                plugins: [
                    storybookTest({
                        configDir: path.join(dirname, '.storybook'),
                        storybookScript: 'pnpm storybook:run --ci',
                    }),
                ],
                test: {
                    browser: {
                        enabled: true, headless: true, instances: [{ browser: 'chromium' }], provider: playwright(),
                    }, name: 'storybook',
                },
            },
        ],
    },
});
