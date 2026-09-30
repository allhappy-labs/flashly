import type { FileDropzonePreview } from '@/components/ui/file-dropzone';
import type { DeckZipParseResult } from '@/utils/deck-zip';
import { DeckImportPreview, type DeckImportPreviewProps } from './deck-import-preview';

/**
 * Preview data for a deck imported from a .flashly file
 */
export interface DeckPreviewData {
    name: string;
    description?: string | null;
    cardCount: number;
    locale: string;
    materialType?: string | null;
    deckType?: string | null;
    exportedAt?: string | null;
}

/**
 * Default fallback values for deck preview data
 */
const DEFAULT_FALLBACKS: Partial<DeckPreviewData> = {
    description: null,
    materialType: null,
    deckType: null,
    exportedAt: null,
};

/**
 * Adapts a DeckZipParseResult to DeckPreviewData with safe fallbacks
 *
 * @param deck - The parsed deck result
 * @param fallbacks - Optional custom fallback values
 * @returns Adapted preview data
 */
export function adaptDeckToPreview(
    deck: DeckZipParseResult,
    fallbacks: Partial<DeckPreviewData> = {}
): DeckPreviewData {
    const mergedFallbacks = { ...DEFAULT_FALLBACKS, ...fallbacks };

    return {
        name: deck.config?.deck.name || mergedFallbacks.name || 'Untitled Deck',
        description: deck.config?.deck.description ?? mergedFallbacks.description ?? null,
        cardCount: deck.cards.length,
        locale: deck.config?.deck.locale || deck.locale || mergedFallbacks.locale || 'en',
        materialType: deck.config?.deck.materialType ?? mergedFallbacks.materialType ?? null,
        deckType: deck.config?.deck.deckType ?? mergedFallbacks.deckType ?? null,
        exportedAt: deck.config?.exportedAt ?? mergedFallbacks.exportedAt ?? null,
    };
}

/**
 * Creates a FileDropzonePreview from deck data for integration with FileDropzone
 *
 * @param deck - The parsed deck result
 * @param localeLabel - Function to convert locale code to display label
 * @param labels - i18n labels for the preview component
 * @returns A FileDropzonePreview object with DeckImportPreview as the leading content
 */
export function createDeckFileDropzonePreview(
    deck: DeckZipParseResult,
    localeLabel: (locale: string) => string,
    labels: DeckImportPreviewProps['labels']
): FileDropzonePreview {
    const previewData = adaptDeckToPreview(deck);

    return {
        leading: (
            <DeckImportPreview
                data={{
                    ...previewData,
                    locale: localeLabel(previewData.locale),
                }}
                labels={labels}
            />
        ),
    };
}
