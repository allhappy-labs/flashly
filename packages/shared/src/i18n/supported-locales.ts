export type SupportedLocale = 'eng' | 'deu' | 'spa' | 'fra' | 'ukr';

export const supportedLocales: ReadonlyArray<SupportedLocale> = [
    'eng',
    'deu',
    'spa',
    'fra',
    'ukr',
];

const SUPPORTED_LOCALE_SET = new Set<string>(supportedLocales);

export function isSupportedLocale(value: unknown): value is SupportedLocale {
    return typeof value === 'string' && SUPPORTED_LOCALE_SET.has(value);
}
