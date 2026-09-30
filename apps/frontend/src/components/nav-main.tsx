import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';

export function NavMain({
    items,
}: {
    items: {
        title: React.ReactNode;
        url: string;
        icon?: LucideIcon;
        isActive?: boolean;
    }[];
}) {
    const { t } = useTranslation();
    return (
        <SidebarGroup>
            <SidebarGroupLabel>
                {t('web.nav.platform')}
            </SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item, index) => (
                    <SidebarMenuItem key={`${item.url}-${index}`}>
                        <SidebarMenuButton isActive={item.isActive} asChild>
                            <Link to={item.url}>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
