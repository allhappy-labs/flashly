import { QueryClientProvider } from '@tanstack/react-query';
import { Outlet } from '@tanstack/react-router';
import { ThemeProvider } from 'next-themes';
import { I18nextProvider } from 'react-i18next';

import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { i18n, initI18n } from '@/i18n';
import { queryClient } from '@/lib/react-query/query-client';

void initI18n();

export function LocalRootLayout() {
    return (
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
                        <div className="min-h-screen bg-background">
                            <Outlet />
                            <Toaster />
                        </div>
                    </ErrorBoundary>
                </ThemeProvider>
            </I18nextProvider>
        </QueryClientProvider>
    );
}
