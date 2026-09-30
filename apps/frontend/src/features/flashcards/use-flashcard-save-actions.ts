import { useCallback, useState } from 'react';
import type { FlashcardFormat, FlashcardMaterialType, FlashcardsResponse, SupportedLocale } from '@flashly/shared/src';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';

import { bulkCreateCards, createDeck } from '@/lib/api/deck-service';
import { getAccentKeyForMaterialType } from '@/utils/deck-accent';
import { toAppendDeckCardInputs } from './utils/flashcard-generator-utils';

type GeneratedDeckEntry = Readonly<{
    locale: SupportedLocale;
    flashcards: FlashcardsResponse;
}>;

type UseFlashcardSaveActionsParams = Readonly<{
    deckName: string;
    materialType: FlashcardMaterialType;
    format: FlashcardFormat;
    generatedDecks: readonly GeneratedDeckEntry[];
    defaultDeck: GeneratedDeckEntry | null;
    getLocaleLabel: (locale: SupportedLocale) => string;
    openRouterApiKey: string;
    openRouterModel: string;
    openRouterBaseUrl: string;
    baseLocale: SupportedLocale;
    navigateToMyDecks: () => void;
    t: TFunction;
}>;

const MAX_DECK_NAME_LENGTH = 200;

function toSafeDeckName(baseName: string, localeLabel: string | null): string {
    if (!localeLabel) {
        return baseName.slice(0, MAX_DECK_NAME_LENGTH).trim();
    }

    const suffix = ` (${localeLabel})`;
    const maxBaseLength = Math.max(1, MAX_DECK_NAME_LENGTH - suffix.length);
    const trimmedBase = baseName.slice(0, maxBaseLength).trim();
    return `${trimmedBase}${suffix}`.slice(0, MAX_DECK_NAME_LENGTH);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function extractOpenRouterMessageContent(value: unknown): string | null {
    if (!isObjectRecord(value)) {
        return null;
    }

    const choices = value.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
        return null;
    }

    const firstChoice = choices[0];
    if (!isObjectRecord(firstChoice)) {
        return null;
    }

    const message = firstChoice.message;
    if (!isObjectRecord(message)) {
        return null;
    }

    const content = message.content;
    return typeof content === 'string' ? content : null;
}

function normalizeTranslatedDeckName(value: string): string {
    const firstNonEmptyLine = value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0) ?? '';

    return firstNonEmptyLine
        .replace(/^["'`]+/, '')
        .replace(/["'`]+$/, '')
        .trim();
}

async function translateDeckNameForLocale(params: Readonly<{
    deckName: string;
    targetLocale: SupportedLocale;
    targetLanguageLabel: string;
    apiKey: string;
    model: string;
    baseUrl: string;
}>): Promise<string | null> {
    if (!params.apiKey.trim() || !params.model.trim()) {
        return null;
    }

    const prompt = [
        `Translate the flashcard deck title into ${params.targetLanguageLabel} (${params.targetLocale}).`,
        'Rules:',
        '- Return only the translated deck title.',
        '- Do not add quotes, numbering, prefixes, or explanations.',
        '- Keep the title concise and natural for native speakers.',
        '',
        `Source title: ${params.deckName}`,
    ].join('\n');

    const response = await fetch(`${params.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${params.apiKey.trim()}`,
            'Content-Type': 'application/json',
            ...(typeof window !== 'undefined' && window.location.origin
                ? { 'HTTP-Referer': window.location.origin }
                : {}),
            'X-Title': 'Flashly',
        },
        body: JSON.stringify({
            model: params.model.trim(),
            temperature: 0.2,
            messages: [
                {
                    role: 'system',
                    content: 'You are a precise translation assistant for app UI labels.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        }),
    });

    if (!response.ok) {
        return null;
    }

    const payload = await response.json();
    const rawContent = extractOpenRouterMessageContent(payload);
    if (!rawContent) {
        return null;
    }

    const normalized = normalizeTranslatedDeckName(rawContent);
    return normalized.length > 0 ? normalized : null;
}

export function useFlashcardSaveActions(params: UseFlashcardSaveActionsParams) {
    const [isSavingToMyDecks, setIsSavingToMyDecks] = useState(false);

    const handleAddToMyDecks = useCallback(async () => {
        if (isSavingToMyDecks) {
            return;
        }

        const sourceDecks = params.generatedDecks.length > 0
            ? params.generatedDecks
            : (params.defaultDeck ? [params.defaultDeck] : []);

        if (sourceDecks.length === 0) {
            toast.error(params.t('web.flashcards.noDownloadYet'));
            return;
        }

        const baseDeckName = (params.deckName.trim() || params.t('web.flashcards.deckNamePlaceholder')).trim();
        setIsSavingToMyDecks(true);

        try {
            let createdDeckCount = 0;
            const translatedNamesByLocale = new Map<SupportedLocale, string>();

            if (sourceDecks.length > 1) {
                const translationResults = await Promise.all(
                    sourceDecks.map(async (deck) => {
                        if (deck.locale === params.baseLocale) {
                            return {
                                locale: deck.locale,
                                translatedName: baseDeckName,
                            };
                        }

                        const translatedName = await translateDeckNameForLocale({
                            deckName: baseDeckName,
                            targetLocale: deck.locale,
                            targetLanguageLabel: params.getLocaleLabel(deck.locale),
                            apiKey: params.openRouterApiKey,
                            model: params.openRouterModel,
                            baseUrl: params.openRouterBaseUrl,
                        });

                        return {
                            locale: deck.locale,
                            translatedName,
                        };
                    }),
                );

                for (const result of translationResults) {
                    if (result.translatedName) {
                        translatedNamesByLocale.set(result.locale, result.translatedName);
                    }
                }
            }

            for (const sourceDeck of sourceDecks) {
                const cards = toAppendDeckCardInputs(sourceDeck.flashcards.flashcards);
                if (cards.length === 0) {
                    continue;
                }

                const translatedDeckName = translatedNamesByLocale.get(sourceDeck.locale) ?? null;
                const nextDeckName = sourceDecks.length > 1
                    ? toSafeDeckName(
                        translatedDeckName ?? baseDeckName,
                        translatedDeckName ? null : params.getLocaleLabel(sourceDeck.locale),
                    )
                    : toSafeDeckName(baseDeckName, null);

                const createdDeck = await createDeck({
                    name: nextDeckName,
                    accentKey: getAccentKeyForMaterialType(params.materialType),
                    materialType: params.materialType,
                    deckType: params.format,
                    locale: sourceDeck.locale,
                });

                const deck = createdDeck.match(
                    (value) => value,
                    (apiError) => {
                        throw new Error(apiError.message || params.t('web.flashcards.addToMyDecksError'));
                    },
                );

                const createCardsResult = await bulkCreateCards(deck.id, cards);
                createCardsResult.match(
                    () => undefined,
                    (apiError) => {
                        throw new Error(apiError.message || params.t('web.flashcards.addToMyDecksError'));
                    },
                );

                createdDeckCount += 1;
            }

            if (createdDeckCount === 0) {
                toast.error(params.t('web.flashcards.noDownloadYet'));
                return;
            }

            toast.success(params.t('web.flashcards.addToMyDecksSuccess', { count: createdDeckCount }));
            params.navigateToMyDecks();
        } catch (error) {
            const message = error instanceof Error ? error.message : params.t('web.flashcards.addToMyDecksError');
            toast.error(message);
        } finally {
            setIsSavingToMyDecks(false);
        }
    }, [
        isSavingToMyDecks,
        params.deckName,
        params.defaultDeck,
        params.format,
        params.generatedDecks,
        params.getLocaleLabel,
        params.baseLocale,
        params.materialType,
        params.navigateToMyDecks,
        params.openRouterApiKey,
        params.openRouterBaseUrl,
        params.openRouterModel,
        params.t,
    ]);

    return {
        isSavingToMyDecks,
        handleAddToMyDecks,
    };
}
