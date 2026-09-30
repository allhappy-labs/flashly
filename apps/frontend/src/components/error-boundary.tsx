'use client';

import * as React from 'react';
import {
    ErrorBoundary as ReactErrorBoundary,
    type FallbackProps,
    type OnErrorCallback,
} from 'react-error-boundary';
export { useErrorBoundary } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { type PropsWithChildren, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

function ErrorFallback({ error, resetErrorBoundary }: Readonly<FallbackProps>) {
    const { t } = useTranslation();

    useEffect(() => {
        console.error('ErrorBoundary caught an error:', error);
        toast.error(t('web.error.toast'));
    }, [error, t]);

    const handleGoHome = useCallback(() => {
        globalThis.location.href = '/';
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="py-6 max-w-md w-full">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 text-destructive">
                        <AlertCircle className="h-full w-full" />
                    </div>
                    <CardTitle>
                        {t('web.error.title')}
                    </CardTitle>
                    <CardDescription>
                        {t('web.error.subtitle')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-sm text-muted-foreground mb-6">
                        {t('web.error.description')}
                    </p>
                    <div className="flex gap-4">
                        <Button onClick={handleGoHome} variant="outline" className="flex-1">
                            <Home className="mr-2 h-4 w-4" />
                            {t('web.error.goHome')}
                        </Button>
                        <Button onClick={resetErrorBoundary} className="flex-1">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            {t('web.error.tryAgain')}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

interface ErrorBoundaryProps extends PropsWithChildren {
    fallback?: React.ComponentType<FallbackProps>;
    onError?: OnErrorCallback;
}

export function ErrorBoundary({
    children,
    fallback: FallbackComponent = ErrorFallback,
    onError,
}: Readonly<ErrorBoundaryProps>) {
    const handleError = React.useCallback(
        (error: unknown, errorInfo: React.ErrorInfo) => {
            console.error('ErrorBoundary caught an error:', error, errorInfo);

            if (onError) {
                onError(error, errorInfo);
            }
        },
        [onError],
    );

    return (
        <ReactErrorBoundary FallbackComponent={FallbackComponent} onError={handleError}>
            {children}
        </ReactErrorBoundary>
    );
}
