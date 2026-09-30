import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ThemePreference = 'system' | 'light' | 'dark';

function isThemePreference(value: string | undefined): value is ThemePreference {
    return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemePreferenceField() {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const selectedTheme = isThemePreference(theme) ? theme : 'system';

    const handleThemeChange = useCallback((value: string) => {
        if (!isThemePreference(value)) {
            return;
        }

        setTheme(value);
    }, [setTheme]);

    return (
        <section className="space-y-3" aria-labelledby="appearance-settings-title">
            <div className="space-y-1">
                <h3 id="appearance-settings-title" className="text-base font-semibold">
                    {t('web.settings.appearance.title')}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {t('web.settings.appearance.description')}
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="appearance-theme-select">
                    {t('web.settings.appearance.theme')}
                </Label>
                <Select value={selectedTheme} onValueChange={handleThemeChange}>
                    <SelectTrigger id="appearance-theme-select">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="system">
                            {t('web.settings.appearance.auto')}
                        </SelectItem>
                        <SelectItem value="light">
                            {t('web.settings.appearance.light')}
                        </SelectItem>
                        <SelectItem value="dark">
                            {t('web.settings.appearance.dark')}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </section>
    );
}
