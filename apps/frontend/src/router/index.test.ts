import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/loading-fallback', () => ({
    LoadingFallback: () => null,
}));

vi.mock('@/config/app-mode', () => ({
    isHostedMode: false,
}));

import { router } from './index';

describe('router mode selection', () => {
    it('registers only the constructed local generator paths', () => {
        expect(Object.keys(router.routesByPath).sort()).toEqual(['/', '/generate']);
    });
});
