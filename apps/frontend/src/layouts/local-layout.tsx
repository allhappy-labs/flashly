import logoHorizontalUrl from '@flashly/branding/assets/logo-horizontal.svg';
import { Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { ErrorBoundary } from '@/components/error-boundary';
import { LanguageSwitcher } from '@/components/language-switcher';

export function LocalLayout() {
    const currentYear = new Date().getFullYear();
    const { t } = useTranslation();

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
