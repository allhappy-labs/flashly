import { describe, expect, it } from 'vitest';

import { getSecuredLayoutBreadcrumbs } from './secured-layout-breadcrumbs';

const t = (key: string) => key;

describe('secured-layout-breadcrumbs', () => {
    it('returns route-aware breadcrumbs for deck editor pages', () => {
        const breadcrumbs = getSecuredLayoutBreadcrumbs('/deck-editor/abc123', t);

        expect(breadcrumbs).toEqual([
            { isLast: false, label: 'web.nav.home', path: '/dashboard' },
            { isLast: false, label: 'web.nav.myDecks', path: '/my-decks' },
            { isLast: true, label: 'decks.editorTitle', path: '/deck-editor/abc123' },
        ]);
    });

    it('returns route-aware breadcrumbs for deck analytics pages', () => {
        const breadcrumbs = getSecuredLayoutBreadcrumbs('/my-decks/abc123/analytics', t);

        expect(breadcrumbs).toEqual([
            { isLast: false, label: 'web.nav.home', path: '/dashboard' },
            { isLast: false, label: 'web.nav.myDecks', path: '/my-decks' },
            { isLast: true, label: 'analytics.title', path: '/my-decks/abc123/analytics' },
        ]);
    });

    it('falls back to configured exact labels and segment labels', () => {
        const breadcrumbs = getSecuredLayoutBreadcrumbs('/marketplace', t);
        expect(breadcrumbs).toEqual([
            { isLast: false, label: 'web.nav.home', path: '/dashboard' },
            { isLast: true, label: 'web.nav.marketplace', path: '/marketplace' },
        ]);
    });
});
