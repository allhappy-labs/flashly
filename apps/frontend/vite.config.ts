import { defineConfig } from 'vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

import { resolve } from 'node:path';

function getManualChunk(id: string): string | undefined {
    if (!id.includes('node_modules')) {
        return undefined;
    }

    if (id.includes('/react-dom/') || id.includes('/react/')) {
        return 'vendor-react';
    }
    if (id.includes('/@tanstack/')) {
        return 'vendor-tanstack';
    }
    if (id.includes('/lucide-react/')) {
        return 'vendor-icons';
    }
    if (
        id.includes('/react-hook-form/')
        || id.includes('/@hookform/')
    ) {
        return 'vendor-forms';
    }
    if (id.includes('/zod/')) {
        return 'vendor-schema';
    }

    return undefined;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    assetsInclude: ['**/*.wasm', '**/*.woff2'], plugins: [
        viteReact(),
        babel({ presets: [reactCompilerPreset()] }),
        tailwindcss(),
        // Add bundle analyzer for analyze mode
        mode === 'analyze' &&
            visualizer({
                brotliSize: true, filename: 'dist/bundle-analysis.html', gzipSize: true, open: true,
            }),
    ].filter(Boolean), resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    }, build: {
        rollupOptions: {
            output: {
                manualChunks: getManualChunk,
            },
        },
    }, server: {
        allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0'],
    }, // Include WASM and font files as assets
}));
