import JSZip from 'jszip';
import {
    FlashcardSchema,
    parseExportConfig,
    type FlashcardsResponse,
} from '@flashly/shared/src';
import type { ExportConfig } from '@flashly/shared/src';
import { isSupportedLocale, type SupportedLocale } from '@flashly/shared/src/i18n/supported-locales';
import { createLogger } from './logger';

const logger = createLogger('deck-zip', {
    debugEnabled: import.meta.env.DEV || import.meta.env.VITE_ENABLE_DECK_ZIP_DEBUG === 'true',
});

/**
 * Error codes for deck zip parsing
 */
export enum DeckZipError {
    UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
    MISSING_DECK_JSONL = 'MISSING_DECK_JSONL',
    MISSING_CONFIG = 'MISSING_CONFIG',
    NO_CARDS = 'NO_CARDS',
    PARSE_ERROR = 'PARSE_ERROR',
    INVALID_LOCALE = 'INVALID_LOCALE',
}

class DeckZipParseError extends Error {
    readonly code: DeckZipError;

    constructor(code: DeckZipError) {
        super(code);
        this.name = 'DeckZipParseError';
        this.code = code;
    }
}

/**
 * Result of parsing a deck zip file
 */
export interface DeckZipParseResult {
    cards: FlashcardsResponse['flashcards'];
    config: ExportConfig | null;
    fileName: string;
    locale: SupportedLocale | null;
}

export interface ReadDeckZipFileOptions {
    requireLocale?: boolean;
}

/**
 * Options for importing a deck
 */
export interface ImportConfirmOptions {
    mode: 'create' | 'update';
    regenerate: {
        audio: boolean;
        images: boolean;
        regenerateExisting: boolean;
    };
    useAsBaseDeck?: boolean;
}

/**
 * Result of analyzing missing assets
 */
export interface MissingAssets {
    missingImages: number;
    missingAudio: number;
    totalCards: number;
    hasImages: number;
    hasAudio: number;
}

/**
 * Validates if a filename has the .flashly extension
 */
function isValidDeckFile(filename: string): boolean {
    return filename.toLowerCase().endsWith('.flashly');
}

/**
 * Reads and parses a deck zip file with strict validation
 * Requires both deck.jsonl and export-config.json; locale validation is configurable.
 *
 * @param file - The zip file to parse
 * @returns Parsed deck data with cards and config
 * @throws Error if zip is invalid or missing required files
 */
export async function readDeckZipFile(
    file: File,
    options: ReadDeckZipFileOptions = {},
): Promise<DeckZipParseResult> {
    // Validate file extension
    if (!isValidDeckFile(file.name)) {
        throw new DeckZipParseError(DeckZipError.UNSUPPORTED_FORMAT);
    }
    const zip = await JSZip.loadAsync(file);

    // DEBUG: Log all files in the archive
    logger.debug('Archive contents:');
    for (const [path, file] of Object.entries(zip.files)) {
        logger.debug(`- ${path} ${file.dir ? '(dir)' : '(file)'}`);
    }

    // STRICT VALIDATION: Require both deck.jsonl and deck.config.json
    // Check for file existence BEFORE trying to read
    // DEBUG: Log what we're searching for
    logger.debug('Looking for: deck.jsonl');

    const deckJsonlFile = zip.file('deck.jsonl');
    if (!deckJsonlFile) {
        logger.error('deck.jsonl not found in archive');
        throw new DeckZipParseError(DeckZipError.MISSING_DECK_JSONL);
    }
    const deckJsonl = await deckJsonlFile.async('string');

    // DEBUG: Log what we're searching for
    logger.debug('Looking for: deck.config.json');

    const configJsonFile = zip.file('deck.config.json');
    if (!configJsonFile) {
        logger.error('deck.config.json not found in archive');
        throw new DeckZipParseError(DeckZipError.MISSING_CONFIG);
    }
    const configJson = await configJsonFile.async('string');

    // Parse cards
    const cards = parseDeckJsonl(deckJsonl);

    if (!cards.length) {
        throw new DeckZipParseError(DeckZipError.NO_CARDS);
    }

    // Extract media files from ZIP and attach to cards
    const cardsWithMedia = await attachMediaFromZip(cards, zip);

    // Parse config
    const config = parseExportConfig(configJson);

    if (!config) {
        throw new DeckZipParseError(DeckZipError.PARSE_ERROR);
    }

    // Validate locale when required by caller
    const rawLocale = config.deck?.locale;
    const locale: SupportedLocale | null = isSupportedLocale(rawLocale) ? rawLocale : null;

    if (options.requireLocale !== false && !locale) {
        throw new DeckZipParseError(DeckZipError.INVALID_LOCALE);
    }

    return {
        cards: cardsWithMedia,
        config,
        fileName: file.name,
        locale,
    };
}

/**
 * Parses deck.jsonl content into flashcards
 *
 * @param content - JSONL content string
 * @returns Array of parsed flashcards
 */
function parseDeckJsonl(content: string): FlashcardsResponse['flashcards'] {
    const lines = content.split(/\r?\n/).filter(Boolean);
    const cards: FlashcardsResponse['flashcards'] = [];

    for (let i = 0; i < lines.length; i++) {
        try {
            const parsed = JSON.parse(lines[i]);
            const card = FlashcardSchema.parse(parsed);
            cards.push(card);
        } catch (error) {
            logger.warn(`Failed to parse card at line ${i + 1}:`, error);
            // Continue parsing other cards
        }
    }

    return cards;
}

/**
 * Merges imported cards with existing cards by front text (deduplication)
 * Cards with matching front text (case-insensitive, trimmed) are considered duplicates
 * and the existing card is kept, not replaced.
 *
 * @param existing - Current flashcards
 * @param imported - New flashcards to import
 * @returns Merged array of flashcards
 */
export function mergeCardsByFront(
    existing: FlashcardsResponse['flashcards'],
    imported: FlashcardsResponse['flashcards'],
): FlashcardsResponse['flashcards'] {
    const existingByFront = new Map<string, FlashcardsResponse['flashcards'][number]>();

    // Build lookup of existing cards by front text
    for (const card of existing) {
        const key = normalizeFrontKey(card.front);
        if (key && !existingByFront.has(key)) {
            existingByFront.set(key, card);
        }
    }

    const merged = [...existing];

    // Add imported cards that aren't duplicates
    for (const card of imported) {
        const key = normalizeFrontKey(card.front);
        if (!key || !existingByFront.has(key)) {
            merged.push(card);
        }
    }

    return merged;
}

/**
 * Normalizes front text for comparison (trim and lowercase)
 */
function normalizeFrontKey(value: string | undefined | null): string {
    return (value ?? '').trim().toLowerCase();
}

/**
 * Detects missing assets (images and audio) in a set of cards
 *
 * @param cards - Flashcards to analyze
 * @returns Object with counts of missing and existing assets
 */
export function detectMissingAssets(cards: FlashcardsResponse['flashcards']): MissingAssets {
    let missingImages = 0;
    let missingAudio = 0;
    let hasImages = 0;
    let hasAudio = 0;

    for (const card of cards) {
        // Check for image (either URL or path)
        const hasImage = Boolean(card.imageUrl?.trim() || card.imagePath?.trim());
        if (hasImage) {
            hasImages++;
        } else {
            missingImages++;
        }

        // Check for audio (either URL or path)
        const hasAudioCard = Boolean(card.audioUrl?.trim() || card.audioPath?.trim());
        if (hasAudioCard) {
            hasAudio++;
        } else {
            missingAudio++;
        }
    }

    return {
        missingImages,
        missingAudio,
        totalCards: cards.length,
        hasImages,
        hasAudio,
    };
}

/**
 * Filters cards to only those needing asset generation
 *
 * @param cards - All flashcards
 * @param regenerateExisting - Whether to include cards that already have assets
 * @param assetType - 'audio' or 'image'
 * @returns Cards needing the specified asset
 */
export function filterCardsNeedingAsset(
    cards: FlashcardsResponse['flashcards'],
    regenerateExisting: boolean,
    assetType: 'audio' | 'image',
): FlashcardsResponse['flashcards'] {
    if (regenerateExisting) {
        // Return all cards
        return cards;
    }

    // Return only cards missing the asset
    return cards.filter((card) => {
        if (assetType === 'audio') {
            return !card.audioUrl?.trim() && !card.audioPath?.trim();
        } else {
            return !card.imageUrl?.trim() && !card.imagePath?.trim();
        }
    });
}

/**
 * Extracts media files from a ZIP archive and attaches them to cards as data URLs
 *
 * @param cards - Flashcards that may have imagePath/audioPath references
 * @param zip - JSZip instance containing media files
 * @returns Cards with imageUrl/audioUrl populated from ZIP files
 */
async function attachMediaFromZip(
    cards: FlashcardsResponse['flashcards'],
    zip: JSZip,
): Promise<FlashcardsResponse['flashcards']> {
    const imagePathMap = new Map<string, string>();
    const audioPathMap = new Map<string, string>();

    // Extract all media files from ZIP
    for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) {
            continue;
        }
        const lowerPath = path.toLowerCase();
        const isImage = lowerPath.startsWith('media/images/');
        const isAudio = lowerPath.startsWith('media/audio/');

        if (!isImage && !isAudio) {
            continue;
        }

        try {
            const buffer = await zipEntry.async('arraybuffer');
            const base64 = arrayBufferToBase64(buffer);
            const mimeType = getMimeTypeFromPath(path);
            const dataUrl = `data:${mimeType};base64,${base64}`;

            if (isImage) {
                imagePathMap.set(path, dataUrl);
            }
            if (isAudio) {
                audioPathMap.set(path, dataUrl);
            }
        } catch (error) {
            logger.warn(`Failed to extract media file ${path}:`, error);
        }
    }

    logger.debug(`Extracted ${imagePathMap.size} image files and ${audioPathMap.size} audio files from ZIP`);

    // Attach data URLs to cards
    return cards.map((card) => {
        const nextCard = { ...card };
        if (card.imagePath && imagePathMap.has(card.imagePath)) {
            nextCard.imageUrl = imagePathMap.get(card.imagePath);
        }
        if (card.audioPath && audioPathMap.has(card.audioPath)) {
            nextCard.audioUrl = audioPathMap.get(card.audioPath);
        }
        return nextCard;
    });
}

/**
 * Converts an ArrayBuffer to a base64 string
 *
 * @param buffer - ArrayBuffer to convert
 * @returns Base64 encoded string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Determines MIME type from file path
 *
 * @param path - File path with extension
 * @returns MIME type string
 */
function getMimeTypeFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        case 'gif':
            return 'image/gif';
        case 'svg':
            return 'image/svg+xml';
        case 'mp3':
        case 'mpeg':
            return 'audio/mpeg';
        case 'wav':
            return 'audio/wav';
        case 'ogg':
            return 'audio/ogg';
        case 'm4a':
            return 'audio/mp4';
        case 'webm':
            return 'audio/webm';
        case 'flac':
            return 'audio/flac';
        default:
            return 'application/octet-stream';
    }
}
