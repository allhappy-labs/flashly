import { z } from 'zod';
import eng from './locales/eng';
import deu from './locales/deu';
import spa from './locales/spa';
import fra from './locales/fra';
import ukr from './locales/ukr';
import { getLocaleName, LOCALE_NAMES } from './locale-names';

export const translations = {
    eng,
    deu,
    spa,
    fra,
    ukr,
};

export type SupportedLocale = keyof typeof translations;

const localeAliases: Record<string, SupportedLocale> = {
    en: "eng",
    de: "deu",
    es: "spa",
    fr: "fra",
    uk: "ukr",
};

// Zod schema for validating translation resources structure at runtime
const TranslationResourceSchema = z.object({
    translation: z.record(z.string(), z.unknown()),
});

type TranslationResource = z.infer<typeof TranslationResourceSchema>;

const baseResources = Object.fromEntries(
    Object.entries(translations).map(([locale, translation]) => {
        const translationWithOptionalDecks = translation as (typeof translations)[SupportedLocale] & {
            decks?: unknown;
            web?: { decks?: unknown };
        };
        const normalizedTranslation = {
            ...translation,
            decks: translationWithOptionalDecks.decks ?? translationWithOptionalDecks.web?.decks,
        };

        // Validate the structure at runtime to ensure type safety
        const resource: TranslationResource = { translation: normalizedTranslation };
        const result = TranslationResourceSchema.safeParse(resource);
        if (!result.success) {
            throw new Error(`Invalid translation structure for locale "${locale}": ${result.error.message}`);
        }

        return [locale, result.data];
    }),
) as Record<SupportedLocale, TranslationResource>;

export const i18nResources = Object.assign(
    {},
    baseResources,
    Object.fromEntries(
        Object.entries(localeAliases).map(([alias, canonical]) => [
            alias,
            baseResources[canonical],
        ]),
    ),
);

export const supportedLocales: SupportedLocale[] = Object.keys(translations) as SupportedLocale[];

export { getLocaleName, LOCALE_NAMES };
