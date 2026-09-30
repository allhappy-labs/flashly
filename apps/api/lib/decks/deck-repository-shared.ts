import type { decks, cards, deckSyncState } from '../auth/auth-schema.ts';
import { QuizEnrichmentSchema, type QuizEnrichment } from '@flashly/shared';

export type Deck = typeof decks.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type DeckWithCards = Deck & { cards: Card[] };
export type DeckWithStats = Deck & {
    cardCount: number;
    downloadCount: number;
    viewCount: number;
};

export type PaginatedDecks = {
    items: DeckWithStats[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
};

export type SyncState = typeof deckSyncState.$inferSelect;

export type CardMutationInput = {
    front: string;
    back: string;
    imageUrl?: string;
    audioUrl?: string;
    category?: string;
    pos?: string;
    gender?: string;
    example?: string;
    tags?: string;
    quiz?: QuizEnrichment | null;
};

export type CardPartialMutationInput = {
    front?: string;
    back?: string;
    imageUrl?: string;
    audioUrl?: string;
    category?: string;
    pos?: string;
    gender?: string;
    example?: string;
    tags?: string;
    quiz?: QuizEnrichment | null;
};

function toIso(value?: Date | null): string | null {
    if (!value) {
        return null;
    }

    return value.toISOString();
}

function normalizeTags(value?: string | null): string[] {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
    } catch {
        // fallthrough
    }

    return value
        .split(/[;,]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function normalizeQuiz(value: unknown): QuizEnrichment | null {
    const result = QuizEnrichmentSchema.safeParse(value);
    return result.success ? result.data : null;
}

export function buildDeckPayload(deck: Deck) {
    return {
        id: deck.id,
        userId: deck.userId,
        name: deck.name,
        description: deck.description ?? null,
        accentKey: deck.accentKey ?? null,
        materialType: deck.materialType ?? null,
        deckType: deck.deckType ?? null,
        locale: deck.locale ?? null,
        marketplaceMetadata: deck.marketplaceMetadata ?? null,
        visibility: deck.visibility,
        isFeatured: deck.isFeatured,
        downloadCount: Number(deck.downloadCount ?? 0),
        viewCount: Number(deck.viewCount ?? 0),
        lastSyncedAt: toIso(deck.lastSyncedAt),
        createdAt: toIso(deck.createdAt),
        updatedAt: toIso(deck.updatedAt),
        lastStudiedAt: toIso(deck.lastStudiedAt),
    };
}

export function buildCardPayload(card: Card) {
    return {
        id: card.id,
        deckId: card.deckId,
        front: card.front,
        back: card.back,
        imageUrl: card.imageUrl ?? null,
        audioUrl: card.audioUrl ?? null,
        category: card.category ?? null,
        pos: card.pos ?? null,
        gender: card.gender ?? null,
        example: card.example ?? null,
        tags: normalizeTags(card.tags),
        quiz: normalizeQuiz(card.quiz),
        isStarred: card.isStarred ?? false,
        learnState: card.learnState ?? null,
        learnCorrectStreak: card.learnCorrectStreak ?? null,
        learnCorrectTotal: card.learnCorrectTotal ?? null,
        learnIncorrectTotal: card.learnIncorrectTotal ?? null,
        learnLastAnsweredAt: toIso(card.learnLastAnsweredAt),
        createdAt: toIso(card.createdAt),
        updatedAt: toIso(card.updatedAt),
        lastReviewedAt: toIso(card.lastReviewedAt),
        due: toIso(card.due),
        stability: card.stability ?? null,
        difficulty: card.difficulty ?? null,
        elapsed_days: card.elapsed_days ?? null,
        scheduled_days: card.scheduled_days ?? null,
        learning_steps: card.learning_steps ?? null,
        reps: card.reps ?? null,
        lapses: card.lapses ?? null,
        state: card.state ?? null,
    };
}

export function normalizeCardFrontKey(value: string): string {
    return value.trim().toLowerCase();
}

export function getErrorCause(error: unknown): unknown {
    if (typeof error !== 'object' || error === null) {
        return undefined;
    }

    return Reflect.get(error, 'cause');
}
