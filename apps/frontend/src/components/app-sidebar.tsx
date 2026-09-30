import * as React from 'react';
import { useLocation } from '@tanstack/react-router';
import { DollarSign, Home, BookOpen, Store, WandSparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import logoHorizontalUrl from '@flashly/branding/assets/logo-horizontal.svg';
import logoSymbolUrl from '@flashly/branding/assets/logo-symbol.svg';

import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail, useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/use-auth';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const { t } = useTranslation();
    const sidebar = useSidebar();
    const isCollapsed = sidebar.state === 'collapsed';

    const navItems = React.useMemo(
        () => [
            {
                icon: Home, isActive: location.pathname === '/dashboard', title: t('web.nav.dashboard'), url: '/dashboard',
            },
            {
                icon: BookOpen, isActive: location.pathname === '/my-decks', title: t('web.nav.myDecks'), url: '/my-decks',
            },
            {
                icon: Store, isActive: location.pathname === '/marketplace', title: t('web.nav.marketplace'), url: '/marketplace',
            },
            {
                icon: WandSparkles,
                isActive: location.pathname === '/generate',
                title: t('web.nav.generate'),
                url: '/generate',
            },
            {
                icon: DollarSign, isActive: location.pathname === '/pricing', title: t('web.nav.pricing'), url: '/pricing',
            },
        ],
        [location.pathname, t],
    );

    const handleLogout = React.useCallback(async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }, [logout]);

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <div className={`flex items-center gap-2 px-2 py-1 ${isCollapsed ? 'justify-center' : ''}`}>
                    <img
                        src={isCollapsed ? logoSymbolUrl : logoHorizontalUrl}
                        alt=""
                        aria-hidden="true"
                        className={isCollapsed ? 'h-4 w-4' : 'h-6 w-auto'}
                    />
                    <span className="sr-only">{t('brand.name')}</span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={navItems} />
            </SidebarContent>
            <SidebarFooter>{user && <NavUser user={user} onLogout={handleLogout} />}</SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
