import { Suspense, lazy, type ComponentType } from 'react';
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

import { LoadingFallback } from '@/components/ui/loading-fallback';
import { isHostedMode } from '@/config/app-mode';

const loadingFallback = <LoadingFallback />;

const routePaths = Object.freeze({
    account: '/account',
    billing: '/billing',
    dashboard: '/dashboard',
    deckAnalytics: '/my-decks/$id/analytics',
    deckEditor: '/deck-editor/$id',
    error: '/error',
    generate: '/generate',
    index: '/',
    login: '/login',
    marketplace: '/marketplace',
    myDecks: '/my-decks',
    pricing: '/pricing',
    welcome: '/welcome',
});

type FlashcardsRouteSearch = Readonly<{
    appendDeckId?: string;
    quizDeckId?: string;
    quizCardIds?: string;
}>;

function toOptionalTrimmedString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function validateFlashcardsRouteSearch(search: Record<string, unknown>): FlashcardsRouteSearch {
    return {
        appendDeckId: toOptionalTrimmedString(search.appendDeckId),
        quizDeckId: toOptionalTrimmedString(search.quizDeckId),
        quizCardIds: toOptionalTrimmedString(search.quizCardIds),
    };
}

function discardFlashcardsRouteSearch() {
    return {};
}

function withSuspense(Component: ComponentType) {
    return function SuspendedPage() {
        return (
            <Suspense fallback={loadingFallback}>
                <Component />
            </Suspense>
        );
    };
}

const Login = lazy(() => import('@/pages/login').then((m) => ({ default: m.Login })));
const Dashboard = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.Dashboard })));
const HostedFlashcardsPage = lazy(() => import('@/pages/hosted-flashcards').then((m) => ({
    default: m.HostedFlashcardsPage,
})));
const LocalFlashcardsPage = lazy(() => import('@/pages/local-flashcards').then((m) => ({
    default: m.LocalFlashcardsPage,
})));
const Welcome = lazy(() => import('@/pages/welcome').then((m) => ({ default: m.Welcome })));
const ErrorPage = lazy(() => import('@/pages/error').then((m) => ({ default: m.ErrorPage })));
const Account = lazy(() => import('@/pages/account').then((m) => ({ default: m.Account })));
const Billing = lazy(() => import('@/pages/billing').then((m) => ({ default: m.Billing })));
const Pricing = lazy(() => import('@/pages/pricing').then((m) => ({ default: m.Pricing })));
const MyDecks = lazy(() => import('@/pages/my-decks').then((m) => ({ default: m.MyDecks })));
const Marketplace = lazy(() => import('@/pages/marketplace').then((m) => ({ default: m.Marketplace })));
const DeckEditor = lazy(() => import('@/pages/deck-editor').then((m) => ({ default: m.DeckEditor })));
const DeckAnalytics = lazy(() => import('@/pages/deck-analytics').then((m) => ({ default: m.DeckAnalytics })));
const NotFound = lazy(() => import('@/pages/not-found').then((m) => ({ default: m.NotFound })));
const RootLayout = lazy(() => import('@/layouts/root-layout').then((m) => ({ default: m.RootLayout })));
const PublicLayout = lazy(() => import('@/layouts/public-layout').then((m) => ({ default: m.PublicLayout })));
const SecuredLayout = lazy(() => import('@/layouts/secured-layout').then((m) => ({ default: m.SecuredLayout })));
const LocalRootLayout = lazy(() => import('@/layouts/local-root-layout').then((m) => ({
    default: m.LocalRootLayout,
})));
const LocalLayout = lazy(() => import('@/layouts/local-layout').then((m) => ({ default: m.LocalLayout })));

const rootRoute = createRootRoute({
    component: withSuspense(isHostedMode ? RootLayout : LocalRootLayout),
});

const publicLayoutRoute = createRoute({
    component: withSuspense(PublicLayout),
    getParentRoute: () => rootRoute,
    id: 'public',
});

const securedLayoutRoute = createRoute({
    component: withSuspense(SecuredLayout),
    getParentRoute: () => rootRoute,
    id: 'secured',
});

const hostedIndexRoute = createRoute({
    component: withSuspense(HostedFlashcardsPage),
    getParentRoute: () => publicLayoutRoute,
    path: routePaths.index,
    validateSearch: validateFlashcardsRouteSearch,
});

const loginRoute = createRoute({
    component: withSuspense(Login),
    getParentRoute: () => publicLayoutRoute,
    path: routePaths.login,
});

const dashboardRoute = createRoute({
    component: withSuspense(Dashboard),
    getParentRoute: () => securedLayoutRoute,
    path: routePaths.dashboard,
});

const welcomeRoute = createRoute({
    component: withSuspense(Welcome),
    getParentRoute: () => securedLayoutRoute,
    path: routePaths.welcome,
});

const securedGenerateRoute = createRoute({
    component: withSuspense(HostedFlashcardsPage),
    getParentRoute: () => securedLayoutRoute,
    path: routePaths.generate,
    validateSearch: validateFlashcardsRouteSearch,
});

const accountRoute = createRoute({
    component: withSuspense(Account),
    getParentRoute: () => securedLayoutRoute,
    path: routePaths.account,
});

const billingRoute = createRoute({
    component: withSuspense(Billing),
    getParentRoute: () => securedLayoutRoute,
    path: routePaths.billing,
});

const pricingRoute = createRoute({
    component: withSuspense(Pricing),
    getParentRoute: () => securedLayoutRoute,
    path: routePaths.pricing,
});

const myDecksRoute = createRoute({
    component: withSuspense(MyDecks),
    getParentRoute: () => securedLayoutRoute,
    path: routePaths.myDecks,
});

const marketplaceRoute = createRoute({
    component: withSuspense(Marketplace),
    getParentRoute: () => securedLayoutRoute,
    path: routePaths.marketplace,
});

const deckEditorRoute = createRoute({
    component: withSuspense(DeckEditor),
    getParentRoute: () => securedLayoutRoute,
    path: routePaths.deckEditor,
});

const deckAnalyticsRoute = createRoute({
    component: withSuspense(DeckAnalytics),
    getParentRoute: () => securedLayoutRoute,
    path: routePaths.deckAnalytics,
});

const errorRoute = createRoute({
    component: withSuspense(ErrorPage),
    getParentRoute: () => publicLayoutRoute,
    path: routePaths.error,
});

const localLayoutRoute = createRoute({
    component: withSuspense(LocalLayout),
    getParentRoute: () => rootRoute,
    id: 'local',
});

const localIndexRoute = createRoute({
    component: withSuspense(LocalFlashcardsPage),
    getParentRoute: () => localLayoutRoute,
    path: routePaths.index,
    validateSearch: discardFlashcardsRouteSearch,
});

const localGenerateRoute = createRoute({
    component: withSuspense(LocalFlashcardsPage),
    getParentRoute: () => localLayoutRoute,
    path: routePaths.generate,
    validateSearch: discardFlashcardsRouteSearch,
});

const layoutRoutes = isHostedMode
    ? [
        publicLayoutRoute.addChildren([hostedIndexRoute, loginRoute, errorRoute]),
        securedLayoutRoute.addChildren([
            dashboardRoute,
            welcomeRoute,
            securedGenerateRoute,
            accountRoute,
            billingRoute,
            pricingRoute,
            myDecksRoute,
            deckEditorRoute,
            deckAnalyticsRoute,
            marketplaceRoute,
        ]),
    ]
    : [
        localLayoutRoute.addChildren([localIndexRoute, localGenerateRoute]),
    ];

const routeTree = rootRoute.addChildren(layoutRoutes);

export const router = createRouter({
    context: {},
    defaultNotFoundComponent: withSuspense(NotFound),
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultStructuralSharing: true,
    routeTree,
    scrollRestoration: true,
});

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}
