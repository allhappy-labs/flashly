export const LOCALE_NAMES: Record<string, string> = {
    eng: 'English',
    deu: 'Deutsch',
    spa: 'Español',
    fra: 'Français',
    ukr: 'Українська',
};

export function getLocaleName(locale: string): string {
    return LOCALE_NAMES[locale] || locale;
}
