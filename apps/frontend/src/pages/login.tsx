import { AuthForm } from '@/features/auth/auth-form';
import { authClient } from '@/features/auth/auth-client';
import { IntroCarousel } from '@/components/intro-carousel';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

const ACTIVE_ONE_TIME_TOKEN_VERIFICATIONS = new Set<string>();

export function Login() {
    const { isAuthenticated, isLoading, refreshSession } = useAuth();
    const navigate = useNavigate();
    const [isOneTimeTokenVerifying, setIsOneTimeTokenVerifying] = useState(false);

    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            navigate({ to: '/dashboard' });
        }
    }, [isAuthenticated, isLoading, navigate]);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const token = searchParams.get('ott');
        const tokenVerificationKey = token ? `ott-verification:${token}` : null;

        if (!token || !tokenVerificationKey) {
            return;
        }

        if (window.sessionStorage.getItem(tokenVerificationKey) === 'done') {
            return;
        }
        if (ACTIVE_ONE_TIME_TOKEN_VERIFICATIONS.has(token)) {
            return;
        }

        ACTIVE_ONE_TIME_TOKEN_VERIFICATIONS.add(token);
        window.sessionStorage.setItem(tokenVerificationKey, 'in-progress');

        let cancelled = false;

        const verifyToken = async () => {
            setIsOneTimeTokenVerifying(true);
            let verificationSucceeded = false;

            try {
                await authClient.oneTimeToken.verify({
                    token,
                });
                verificationSucceeded = true;
                window.sessionStorage.setItem(tokenVerificationKey, 'done');
                const nextUrl = new URL(window.location.href);
                nextUrl.searchParams.delete('ott');
                window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
                await refreshSession();
                await navigate({ to: '/dashboard' });
            } catch (error) {
                window.sessionStorage.removeItem(tokenVerificationKey);
                console.error('Failed to verify one-time token:', error);
            } finally {
                if (!verificationSucceeded) {
                    ACTIVE_ONE_TIME_TOKEN_VERIFICATIONS.delete(token);
                }
                if (!cancelled) {
                    setIsOneTimeTokenVerifying(false);
                }
            }
        };

        void verifyToken();

        return () => {
            cancelled = true;
        };
    }, [navigate, refreshSession]);

    // Show loading state while checking authentication
    if (isLoading || isOneTimeTokenVerifying) {
        return (
            <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                </div>
            </div>
        );
    }

    // Don't render the form if user is authenticated (redirect will happen)
    if (isAuthenticated) {
        return null;
    }

    return (
        <div className="mx-auto min-h-[calc(100vh-8rem)] w-full max-w-7xl px-1">
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10 xl:gap-12">
                <div className="order-2 lg:order-1 lg:pt-1">
                    <IntroCarousel />
                </div>
                <div className="order-1 lg:order-2">
                    <AuthForm />
                </div>
            </div>
        </div>
    );
}
