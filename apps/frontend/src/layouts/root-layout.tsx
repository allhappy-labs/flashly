import { Outlet } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/auth-context';
import { GrowthBookContextProvider } from '@/contexts/growthbook-context';
import { ErrorBoundary } from '@/components/error-boundary';
import { I18nextProvider } from 'react-i18next';
import { i18n, initI18n } from '@/i18n';
import { AutumnProvider } from 'autumn-js/react';
import { ThemeProvider } from 'next-themes';
import { queryClient } from '@/lib/react-query/query-client';
import { getFrontendTrpcClient, trpc } from '@/lib/trpc/client';

void initI18n();

export function RootLayout() {
    const betterAuthUrl = import.meta.env.VITE_AUTH_URL
        || import.meta.env.VITE_API_URL
        || 'http://localhost:3001';
    const trpcClient = getFrontendTrpcClient();

    if (!trpcClient) {
        throw new Error('tRPC client not initialized');
    }

    return (
        <trpc.TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
            <QueryClientProvider client={queryClient}>
                <I18nextProvider i18n={i18n}>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem={true}
                        disableTransitionOnChange={true}
                        storageKey="flashly.theme"
                    >
                        <ErrorBoundary>
                            <AuthProvider>
                                <AutumnProvider includeCredentials={true} betterAuthUrl={betterAuthUrl}>
                                    <GrowthBookContextProvider>
                                        <div className="min-h-screen bg-background">
                                            <Outlet />
                                            <Toaster />
                                        </div>
                                    </GrowthBookContextProvider>
                                </AutumnProvider>
                            </AuthProvider>
                        </ErrorBoundary>
                    </ThemeProvider>
                </I18nextProvider>
            </QueryClientProvider>
        </trpc.TRPCProvider>
    );
}
