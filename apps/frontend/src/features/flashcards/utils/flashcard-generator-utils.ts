import {
    FLASHCARD_FORMATS,
    FLASHCARD_MATERIAL_TYPES,
    type FlashcardFormat,
    type FlashcardMaterialType,
    type FlashcardsResponse,
    normalizeQuizEnrichment,
    type QuizEnrichment,
} from '@flashly/shared/src';

export function getStableCardId(card: FlashcardsResponse['flashcards'][number]): string {
    if (typeof card.id === 'number' && card.id > 0) {
        return `card-${card.id}`;
    }

    const front = (card.front ?? '').trim();
    const back = (card.back ?? '').trim();
    const combined = `${front}|||${back}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const safeContent = combined.slice(0, 20).replace(/[^a-z0-9]/gi, '');
    return `card-${Math.abs(hash)}-${safeContent}`;
}

export function normalizeFrontKey(value: string | undefined | null) {
    return (value ?? '').trim().toLowerCase();
}

export function isFlashcardFormatValue(value: string): value is FlashcardFormat {
    return FLASHCARD_FORMATS.some((format) => format === value);
}

export function isFlashcardMaterialTypeValue(value: string): value is FlashcardMaterialType {
    return FLASHCARD_MATERIAL_TYPES.some((materialType) => materialType === value);
}

export function sanitizeDownloadFileName(value: string): string {
    const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    return normalized
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120) || 'deck';
}

export function serializeGeneratedExample(
    example: FlashcardsResponse['flashcards'][number]['example'],
): string | undefined {
    if (!example) {
        return undefined;
    }
    if (typeof example === 'string') {
        const trimmed = example.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    const target = example.target.trim();
    const english = example.english.trim();
    const romanization = example.romanization.trim();
    return [target, english, romanization].filter(Boolean).join(' | ') || undefined;
}

export function serializeGeneratedTags(tags: FlashcardsResponse['flashcards'][number]['tags']): string | undefined {
    if (!Array.isArray(tags)) {
        return undefined;
    }

    const normalized = tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

    return normalized.length > 0 ? normalized.join('; ') : undefined;
}

export type AppendDeckCardInput = Readonly<{
    front: string;
    back: string;
    imageUrl?: string;
    audioUrl?: string;
    category?: string;
    pos?: string;
    gender?: string;
    example?: string;
    tags?: string;
    quiz?: QuizEnrichment;
}>;

function toTrimmedOptionalString(value: string | undefined): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export function toAppendDeckCardInput(card: FlashcardsResponse['flashcards'][number]): AppendDeckCardInput | null {
    const front = (card.front ?? '').trim();
    const back = (card.back ?? '').trim();
    if (!front || !back) {
        return null;
    }

    return {
        front,
        back,
        imageUrl: toTrimmedOptionalString(card.imageUrl),
        audioUrl: toTrimmedOptionalString(card.audioUrl),
        category: toTrimmedOptionalString(card.category),
        pos: toTrimmedOptionalString(card.pos),
        gender: toTrimmedOptionalString(card.gender),
        example: serializeGeneratedExample(card.example),
        tags: serializeGeneratedTags(card.tags),
        quiz: normalizeQuizEnrichment(card.quiz),
    };
}

export function toAppendDeckCardInputs(
    cards: readonly FlashcardsResponse['flashcards'][number][],
): AppendDeckCardInput[] {
    const next: AppendDeckCardInput[] = [];
    for (const card of cards) {
        const mapped = toAppendDeckCardInput(card);
        if (mapped) {
            next.push(mapped);
        }
    }
    return next;
}
