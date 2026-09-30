type Translator = (key: string) => string;

export type SecuredBreadcrumb = Readonly<{
    isLast: boolean;
    label: string;
    path: string;
}>;

const EXACT_BREADCRUMB_LABELS: Record<string, string> = {
    '/dashboard': 'web.nav.dashboard',
    '/pricing': 'web.nav.pricing',
    '/welcome': 'web.nav.welcome',
    '/my-decks': 'web.nav.myDecks',
    '/marketplace': 'web.nav.marketplace',
    '/account': 'web.nav.account',
    '/billing': 'web.nav.billing',
    '/generate': 'web.nav.generate',
};

function buildHomeCrumb(t: Translator): SecuredBreadcrumb {
    return { isLast: false, label: t('web.nav.home'), path: '/dashboard' };
}

function toSegmentLabel(segment: string) {
    return segment.charAt(0).toUpperCase() + segment.slice(1);
}

function buildPathBreadcrumbs(pathname: string, t: Translator): SecuredBreadcrumb[] {
    const segments = pathname.split('/').filter(Boolean);

    if (pathname === '/dashboard') {
        return [{ isLast: true, label: t(EXACT_BREADCRUMB_LABELS['/dashboard']), path: '/dashboard' }];
    }

    const breadcrumbs: SecuredBreadcrumb[] = [buildHomeCrumb(t)];
    let currentPath = '';

    for (const [index, segment] of segments.entries()) {
        currentPath += `/${segment}`;
        const isLast = index === segments.length - 1;
        const labelKey = EXACT_BREADCRUMB_LABELS[currentPath];
        breadcrumbs.push({
            isLast,
            label: labelKey ? t(labelKey) : toSegmentLabel(segment),
            path: currentPath,
        });
    }

    return breadcrumbs;
}

export function getSecuredLayoutBreadcrumbs(pathname: string, t: Translator): SecuredBreadcrumb[] {
    const deckEditorMatch = pathname.match(/^\/deck-editor\/([^/]+)$/);
    if (deckEditorMatch) {
        return [
            buildHomeCrumb(t),
            { isLast: false, label: t('web.nav.myDecks'), path: '/my-decks' },
            { isLast: true, label: t('decks.editorTitle'), path: pathname },
        ];
    }

    const deckAnalyticsMatch = pathname.match(/^\/my-decks\/([^/]+)\/analytics$/);
    if (deckAnalyticsMatch) {
        return [
            buildHomeCrumb(t),
            { isLast: false, label: t('web.nav.myDecks'), path: '/my-decks' },
            { isLast: true, label: t('analytics.title'), path: pathname },
        ];
    }

    return buildPathBreadcrumbs(pathname, t);
}
