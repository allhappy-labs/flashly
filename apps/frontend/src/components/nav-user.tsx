import { Link } from '@tanstack/react-router';
import { BadgeCheck, ChevronsUpDown, Globe, LogOut, Settings, Sparkles } from 'lucide-react';
import { useCustomer } from 'autumn-js/react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { changeLanguage, defaultLocale, isSupportedLocale, locales } from '@/i18n';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SupportedLocale } from '@flashly/shared/src/i18n/supported-locales';

const languageFlags: Record<string, string> = {
    eng: '🇬🇧',
    deu: '🇩🇪',
    ukr: '🇺🇦',
    spa: '🇪🇸',
    fra: '🇫🇷',
};

const getUserInitials = (email: string, name?: string) => {
    if (name) {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase();
    }
    return email.charAt(0).toUpperCase();
};

export function NavUser({
    user,
    onLogout,
}: {
    user: {
        name?: string;
        email: string;
        image?: string | null;
    };
    onLogout: () => void;
}) {
    const { t, i18n } = useTranslation();
    const { isMobile } = useSidebar();
    const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(defaultLocale);
    const { customer: customerData } = useCustomer();

    useEffect(() => {
        const nextLocale = i18n.language;
        if (nextLocale && isSupportedLocale(nextLocale)) {
            setCurrentLocale(nextLocale);
            return;
        }
        setCurrentLocale(defaultLocale);
    }, [i18n.language]);

    const handleLanguageChange = useCallback(async (locale: string) => {
        if (!isSupportedLocale(locale)) {
            return;
        }
        try {
            setCurrentLocale(locale);
            await changeLanguage(locale);
        } catch (error) {
            console.error('Failed to change language:', error);
        }
    }, []);

    const createLanguageClickHandler = useCallback(
        (code: string) => () => {
            handleLanguageChange(code);
        },
        [handleLanguageChange],
    );

    // Check if user has an active paid subscription
    const hasActivePaidSubscription = () => {
        if (!customerData?.products) return false;

        const activeProducts = customerData.products.filter((product: { status: string }) => product.status === 'active');

        // If no active products or only free products, user is on free plan
        return activeProducts.some((product: { id: string }) => product.id !== 'free');
    };

    const showUpgradeOption = hasActivePaidSubscription() === false;

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <Avatar className="h-8 w-8 rounded-lg">
                                <AvatarImage src={user.image || ''} alt={user.name || user.email} />
                                <AvatarFallback className="rounded-lg">
                                    {getUserInitials(user.email, user.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{user.name || user.email}</span>
                                <span className="truncate text-xs">{user.email}</span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                        side={isMobile ? 'bottom' : 'right'}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                <Avatar className="h-8 w-8 rounded-lg">
                                    <AvatarImage src={user.image || ''} alt={user.name || user.email} />
                                    <AvatarFallback className="rounded-lg">
                                        {getUserInitials(user.email, user.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">{user.name || user.email}</span>
                                    <span className="truncate text-xs">{user.email}</span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {showUpgradeOption && (
                            <>
                                <DropdownMenuGroup>
                                    <DropdownMenuItem asChild>
                                        <Link to="/pricing">
                                            <Sparkles />
                                            {t('web.nav.upgrade')}
                                        </Link>
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                            </>
                        )}
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                                <Link to="/account">
                                    <BadgeCheck />
                                    {t('web.nav.account')}
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link to="/billing">
                                    <Settings />
                                    {t('web.nav.billing')}
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Globe />
                                {t('web.nav.language')}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {Object.entries(locales).map(([code, name]) => (
                                    <DropdownMenuItem
                                        key={code}
                                        onClick={createLanguageClickHandler(code)}
                                        className={currentLocale === code ? 'bg-accent text-accent-foreground' : ''}
                                    >
                                        <span className="text-lg leading-none mr-2">{languageFlags[code] ?? '🌐'}</span>
                                        <span>{name}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onLogout}>
                            <LogOut />
                            {t('web.nav.logout')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
