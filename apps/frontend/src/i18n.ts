import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { isSupportedLocale, type SupportedLocale } from '@flashly/shared/src/i18n/supported-locales';

const LANGUAGE_STORAGE_KEY = 'flashly.language';

export const locales: Record<SupportedLocale, string> = {
    eng: 'English',
    deu: 'Deutsch',
    ukr: 'Українська',
    spa: 'Español',
    fra: 'Français',
};

export const defaultLocale: SupportedLocale = 'eng';
const localeResourceLoaders: Record<SupportedLocale, () => Promise<Record<string, unknown>>> = {
    eng: async () => (await import('@flashly/shared/src/i18n/locales/eng')).default,
    deu: async () => (await import('@flashly/shared/src/i18n/locales/deu')).default,
    ukr: async () => (await import('@flashly/shared/src/i18n/locales/ukr')).default,
    spa: async () => (await import('@flashly/shared/src/i18n/locales/spa')).default,
    fra: async () => (await import('@flashly/shared/src/i18n/locales/fra')).default,
};
const localeResourceCache = new Map<SupportedLocale, Promise<Record<string, unknown>>>();

// Map browser language codes (ISO 639-1) to ElevenLabs codes (ISO 639-2/T)
const BROWSER_TO_ELEVENLABS: Record<string, SupportedLocale> = {
    en: 'eng',
    de: 'deu',
    es: 'spa',
    fr: 'fra',
    uk: 'ukr',
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeLocaleResource(resource: Record<string, unknown>): Record<string, unknown> {
    const normalizedResource: Record<string, unknown> = { ...resource };
    const webSection = normalizedResource.web;
    if (!isRecord(webSection)) {
        return normalizedResource;
    }

    const webDecks = webSection.decks;
    if (!isRecord(webDecks)) {
        return normalizedResource;
    }

    const existingDecks = normalizedResource.decks;
    normalizedResource.decks = isRecord(existingDecks)
        ? { ...webDecks, ...existingDecks }
        : webDecks;
    return normalizedResource;
}

export function detectBrowserLocale(): SupportedLocale {
    if (typeof navigator === 'undefined') return defaultLocale;

    const browserLanguages = [...(navigator.languages ?? []), navigator.language]
        .filter((value): value is string => typeof value === 'string' && value.length > 0);

    for (const language of browserLanguages) {
        const browserLang = language.slice(0, 2).toLowerCase();
        const mappedLocale = BROWSER_TO_ELEVENLABS[browserLang];
        if (mappedLocale) {
            return mappedLocale;
        }
    }

    return defaultLocale;
}

export function getSavedLocale(): SupportedLocale {
    if (globalThis.window === undefined) return defaultLocale;
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const legacy = localStorage.getItem('language');
    const candidate = stored ?? legacy;
    return candidate && isSupportedLocale(candidate) ? candidate : detectBrowserLocale();
}

export function saveLocale(locale: SupportedLocale): void {
    if (globalThis.window === undefined) return;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
    localStorage.setItem('language', locale);
}

async function getLocaleResource(locale: SupportedLocale): Promise<Record<string, unknown>> {
    const cachedResource = localeResourceCache.get(locale);
    if (cachedResource) {
        return cachedResource;
    }

    const resourcePromise = localeResourceLoaders[locale]().then((resource) => normalizeLocaleResource(resource));
    localeResourceCache.set(locale, resourcePromise);
    return resourcePromise;
}

async function ensureLocaleBundle(locale: SupportedLocale): Promise<void> {
    if (i18n.hasResourceBundle(locale, 'translation')) {
        return;
    }

    const translation = await getLocaleResource(locale);
    i18n.addResourceBundle(locale, 'translation', translation, true, true);
}

export async function initI18n(preferredLocale?: SupportedLocale): Promise<typeof i18n> {
    if (i18n.isInitialized) return i18n;

    const locale = preferredLocale ?? getSavedLocale();
    const baseTranslation = await getLocaleResource(defaultLocale);
    const activeTranslation = locale === defaultLocale ? baseTranslation : await getLocaleResource(locale);
    const resources: Record<string, { translation: Record<string, unknown> }> = {
        [defaultLocale]: {
            translation: baseTranslation,
        },
    };

    if (locale !== defaultLocale) {
        resources[locale] = {
            translation: activeTranslation,
        };
    }

    await i18n.use(initReactI18next).init({
        resources,
        lng: locale,
        fallbackLng: defaultLocale,
        returnNull: false,
        interpolation: { escapeValue: false },
    });

    return i18n;
}

export async function changeLanguage(locale: SupportedLocale): Promise<void> {
    await ensureLocaleBundle(locale);
    saveLocale(locale);
    await i18n.changeLanguage(locale);
}

export { i18n };
export { isSupportedLocale };
