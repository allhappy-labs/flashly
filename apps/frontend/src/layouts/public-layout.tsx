import { Link, Outlet } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/error-boundary';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import logoHorizontalUrl from '@flashly/branding/assets/logo-horizontal.svg';

export function PublicLayout() {
    const currentYear = new Date().getFullYear();
    const { t } = useTranslation();
    const { isAuthenticated, isLoading } = useAuth();

    return (
        <div className="min-h-screen flex flex-col">
            <header className="border-b">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center">
                        <img
                            src={logoHorizontalUrl}
                            alt={t('brand.name')}
                            className="h-7 w-auto"
                        />
                        <span className="sr-only">{t('brand.name')}</span>
                    </Link>
                    <nav className="flex items-center gap-4">
                        <LanguageSwitcher />
                        {!isLoading && (
                            <Button asChild size="sm">
                                <Link to={isAuthenticated ? '/dashboard' : '/login'}>
                                    {isAuthenticated ? t('web.nav.dashboard') : t('web.auth.signIn')}
                                </Link>
                            </Button>
                        )}
                    </nav>
                </div>
            </header>

            <main className="flex-1 container mx-auto px-4 py-8">
                <ErrorBoundary>
                    <Outlet />
                </ErrorBoundary>
            </main>

            <footer className="border-t mt-auto">
                <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
                    {t('web.footer.copyright', { currentYear })}
                </div>
            </footer>
        </div>
    );
}
