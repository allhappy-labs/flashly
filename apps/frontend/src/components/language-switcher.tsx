import { cn } from '@/utils/style-utils';
import { changeLanguage, defaultLocale, isSupportedLocale, locales } from '@/i18n';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SupportedLocale } from '@flashly/shared/src/i18n/supported-locales';

const languageFlags: Record<string, string> = {
    eng: '🇬🇧',
    deu: '🇩🇪',
    ukr: '🇺🇦',
    spa: '🇪🇸',
    fra: '🇫🇷',
};

export function LanguageSwitcher() {
    const { i18n, t } = useTranslation();
    const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(defaultLocale);

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

    return (
        <Select value={currentLocale} onValueChange={handleLanguageChange}>
            <SelectTrigger
                className={cn(
                    'h-8 w-auto border-input bg-background px-3 text-sm shadow-xs',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:ring-ring/50 focus:ring-[3px]',
                )}
                aria-label={t('common.selectLanguage')}
            >
                <SelectValue />
            </SelectTrigger>

            <SelectContent>
                {Object.entries(locales).map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                        <div className="flex items-center gap-2">
                            <span className="text-lg leading-none">{languageFlags[code] ?? '🌐'}</span>
                            <span>{name}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
