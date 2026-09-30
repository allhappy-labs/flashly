import { and, asc, desc, eq, gt, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { Rating } from "ts-fsrs";
import { ResultAsync, okAsync, errAsync } from 'neverthrow';
import type { Result } from 'neverthrow';
import { getDb } from "./database";
import { cards, decks, studyHistory, studySessions } from "./schema";
import type { Card, DeckAnalytics, DeckWithStats, FsrsState, LearnState, ParsedCard } from "../types/models";
import type { LearnFamiliarity } from "../types/learn";
import { createId } from "../utils/ids";
import { buildFsrsDefaults, getCardRetrievability, scheduleReview } from "../services/fsrsScheduler";
import { deleteAudioIfLocal, deleteDeckMedia, deleteImageIfLocal } from "../services/deckMedia";
import { DEFAULT_DECK_ACCENT_KEY } from "../constants";
import {
    DatabaseError,
    normalizeQuizEnrichment,
    ValidationError,
    safeAsync,
    safeSync,
    type QuizEnrichment,
    errorFactory,
} from '@flashly/shared';
import { getStudyEventRepository } from "../services/sync/study-event-repository";
import { enqueueSyncOperation } from "../services/sync/sync-queue";

type CardRow = typeof cards.$inferSelect;
type DeckStatsFields = {
    cardCount?: number | null;
    dueCount?: number | null;
    newCount?: number | null;
    learningCount?: number | null;
    reviewCount?: number | null;
    relearningCount?: number | null;
    retention?: number | null;
};
type DeckRowLike = {
    id: string;
    name: string;
    description?: string | null;
    accentKey?: string | null;
    materialType?: string | null;
    deckType?: string | null;
    locale?: string | null;
    visibility?: 'private' | 'public' | null;
    createdAt: number;
    updatedAt: number;
    lastStudiedAt?: number | null;
} & DeckStatsFields;

/**
 * Safely parse tags from JSON string
 */
export function parseTags(value?: string | null): Result<string[], ValidationError> {
    if (!value) return safeSync(() => [], () => new ValidationError('Tags value is empty'));

    return safeSync(
        () => {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((t) => String(t).trim()).filter(Boolean);
            }
            // Fallback to comma/semicolon separated
            return value
                .split(/[;,]/)
                .map((t) => t.trim())
                .filter(Boolean);
        },
        (error) => new ValidationError('Failed to parse tags JSON', { cause: error })
    );
}

/**
 * Safely serialize tags to JSON string
 */
export function serializeTags(tags?: string[] | null): string | null {
    if (!tags || !tags.length) return null;
    return JSON.stringify(tags);
}

export function serializeQuiz(value: unknown): string | null {
    const quiz = normalizeQuizEnrichment(value);
    return quiz ? JSON.stringify(quiz) : null;
}

export function parseQuiz(value?: string | null): QuizEnrichment | undefined {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return undefined;
    }

    try {
        return normalizeQuizEnrichment(JSON.parse(value));
    } catch {
        return undefined;
    }
}

/**
 * Normalize FSRS state
 */
function normalizeState(state?: string | null): FsrsState {
    if (!state) return "new";
    const lower = state.toLowerCase();
    if (lower === "learning") return "learning";
    if (lower === "review") return "review";
    if (lower === "relearning") return "relearning";
    return "new";
}

/**
 * Normalize learn state
 */
function normalizeLearnState(state?: string | null): LearnState {
    if (!state) return "not_studied";
    const lower = state.toLowerCase();
    if (lower === "learning") return "learning";
    if (lower === "mastered") return "mastered";
    return "not_studied";
}

/**
 * Normalize database row to Card model
 */
function normalizeCard(row: CardRow): Result<Card, ValidationError> {
    const defaults = buildFsrsDefaults(row.createdAt ?? Date.now());

    return parseTags(row.tags).map((tags) => ({
        id: row.id,
        deckId: row.deckId,
        front: row.front,
        back: row.back,
        imageUrl: row.imageUrl ?? null,
        audioUrl: row.audioUrl ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        due: row.due ?? defaults.due,
        stability: row.stability ?? defaults.stability,
        difficulty: row.difficulty ?? defaults.difficulty,
        elapsed_days: row.elapsed_days ?? defaults.elapsed_days,
        scheduled_days: row.scheduled_days ?? defaults.scheduled_days,
        learning_steps: row.learning_steps ?? defaults.learning_steps,
        reps: row.reps ?? defaults.reps,
        lapses: row.lapses ?? defaults.lapses,
        state: normalizeState(row.state ?? defaults.state),
        lastReviewedAt: row.lastReviewedAt ?? defaults.lastReviewedAt ?? null,
        category: row.category ?? null,
        pos: row.pos ?? null,
        gender: row.gender ?? null,
        example: row.example ?? null,
        tags,
        quiz: parseQuiz(row.quiz),
        isStarred: row.isStarred === 1,
        learnState: normalizeLearnState(row.learnState),
        learnCorrectStreak: row.learnCorrectStreak ?? 0,
        learnCorrectTotal: row.learnCorrectTotal ?? 0,
        learnIncorrectTotal: row.learnIncorrectTotal ?? 0,
        learnLastAnsweredAt: row.learnLastAnsweredAt ?? null,
    }));
}

/**
 * Map deck row with stats
 */
function mapDeckRow(
    row: DeckRowLike,
): DeckWithStats {
    return {
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        accentKey: row.accentKey ?? DEFAULT_DECK_ACCENT_KEY,
        materialType: row.materialType ?? null,
        deckType: row.deckType ?? null,
        locale: row.locale ?? null,
        visibility: row.visibility ?? 'private',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastStudiedAt: row.lastStudiedAt ?? null,
        cardCount: Number(row.cardCount ?? 0),
        dueCount: Number(row.dueCount ?? 0),
        newCount: Number(row.newCount ?? 0),
        learningCount: Number(row.learningCount ?? 0),
        reviewCount: Number(row.reviewCount ?? 0),
        relearningCount: Number(row.relearningCount ?? 0),
        retention: row.retention ?? 1,
    };
}

/**
 * List all decks with stats
 */
export function listDecks(): ResultAsync<DeckWithStats[], DatabaseError> {
    return safeAsync(
        async () => {
            const db = await getDb();
            const endOfToday = new Date();
            endOfToday.setHours(23, 59, 59, 999);

            const counts = db
                .select({
                    deckId: cards.deckId,
                    cardCount: sql<number>`count(*)`.as("cardCount"),
                    dueCount: sql<number>`sum(CASE WHEN ${cards.due} <= ${endOfToday.getTime()} THEN 1 ELSE 0 END)`.as("dueCount"),
                    newCount: sql<number>`sum(CASE WHEN ${cards.state} = 'new' THEN 1 ELSE 0 END)`.as("newCount"),
                    learningCount: sql<number>`sum(CASE WHEN ${cards.state} = 'learning' THEN 1 ELSE 0 END)`.as("learningCount"),
                    reviewCount: sql<number>`sum(CASE WHEN ${cards.state} = 'review' THEN 1 ELSE 0 END)`.as("reviewCount"),
                    relearningCount: sql<number>`sum(CASE WHEN ${cards.state} = 'relearning' THEN 1 ELSE 0 END)`.as("relearningCount"),
                })
                .from(cards)
                .groupBy(cards.deckId)
                .as("counts");

            const retention = db
                .select({
                    deckId: studyHistory.deckId,
                    retention: sql<number>`avg(CASE WHEN ${studyHistory.rating} = ${Rating.Again} THEN 0 ELSE 1 END)`.as("retention"),
                })
                .from(studyHistory)
                .groupBy(studyHistory.deckId)
                .as("retention");

            const rows = await db
                .select({
                    id: decks.id,
                    name: decks.name,
                    description: decks.description,
                    accentKey: decks.accentKey,
                    materialType: decks.materialType,
                    deckType: decks.deckType,
                    locale: decks.locale,
                    createdAt: decks.createdAt,
                    updatedAt: decks.updatedAt,
                    lastStudiedAt: decks.lastStudiedAt,
                    cardCount: counts.cardCount,
                    dueCount: counts.dueCount,
                    newCount: counts.newCount,
                    learningCount: counts.learningCount,
                    reviewCount: counts.reviewCount,
                    relearningCount: counts.relearningCount,
                    retention: retention.retention,
                })
                .from(decks)
                .leftJoin(counts, eq(decks.id, counts.deckId))
                .leftJoin(retention, eq(decks.id, retention.deckId))
                .orderBy(desc(decks.lastStudiedAt), asc(decks.createdAt));

            return rows.map(mapDeckRow);
        },
        (error) => new DatabaseError('Failed to list decks', 'LIST_DECKS_FAILED', { cause: error })
    );
}

/**
 * Get deck by ID with cards
 */
export function getDeck(deckId: string): ResultAsync<DeckWithStats & { cards: Card[] }, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const deck = await db.query.decks.findFirst({
                where: eq(decks.id, deckId),
            });

            if (!deck) {
                throw new DatabaseError('Deck not found', 'DECK_NOT_FOUND');
            }

            const cardRows = await db.query.cards.findMany({
                where: eq(cards.deckId, deckId),
                orderBy: [asc(cards.createdAt), asc(cards.id)],
            });

            return {
                ...mapDeckRow(deck),
                cards: cardRows.map(normalizeCard).filter((result) => result.isOk()).map((result) => result.value),
            };
        },
        (error) => new DatabaseError('Failed to get deck', 'GET_DECK_FAILED', { cause: error })
    );
}

/**
 * Create a new deck
 */
export function createDeck(input: {
    name: string;
    description?: string;
    accentKey?: string;
    materialType?: string;
    deckType?: string;
    locale?: string;
}): ResultAsync<DeckWithStats, DatabaseError | ValidationError> {
    if (!input.name?.trim()) {
        return errAsync(
            errorFactory.validation('Deck name is required', { field: 'name' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const now = Date.now();
            const deck = {
                id: createId(),
                name: input.name.trim(),
                description: input.description?.trim() ?? '',
                accentKey: input.accentKey ?? DEFAULT_DECK_ACCENT_KEY,
                materialType: input.materialType ?? null,
                deckType: input.deckType ?? null,
                locale: input.locale ?? null,
                createdAt: now,
                updatedAt: now,
                lastStudiedAt: null,
            };

            await db.insert(decks).values(deck);
            return mapDeckRow({ ...deck, cardCount: 0, dueCount: 0, newCount: 0, learningCount: 0, reviewCount: 0, relearningCount: 0, retention: 1 });
        },
        (error) => new DatabaseError('Failed to create deck', 'CREATE_DECK_FAILED', { cause: error })
    );
}

/**
 * Update deck
 */
export function updateDeck(
    deckId: string,
    updates: {
        name?: string;
        description?: string;
        accentKey?: string;
        visibility?: 'private' | 'public';
    }
): ResultAsync<DeckWithStats, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    if (!updates.name?.trim() && !updates.description && !updates.accentKey && !updates.visibility) {
        return errAsync(
            errorFactory.validation('At least one field must be updated', { field: 'updates' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const now = Date.now();

            const values: Record<string, unknown> = {
                updatedAt: now,
            };

            if (updates.name) values.name = updates.name.trim();
            if (updates.description !== undefined) values.description = updates.description?.trim() ?? '';
            if (updates.accentKey) values.accentKey = updates.accentKey;
            if (updates.visibility) values.visibility = updates.visibility;

            const result = await db.update(decks)
                .set(values)
                .where(eq(decks.id, deckId))
                .returning();

            if (!result[0]) {
                throw new DatabaseError('Deck not found', 'DECK_NOT_FOUND');
            }

            return mapDeckRow({ ...result[0], cardCount: 0, dueCount: 0, newCount: 0, learningCount: 0, reviewCount: 0, relearningCount: 0, retention: 1 });
        },
        (error) => new DatabaseError('Failed to update deck', 'UPDATE_DECK_FAILED', { cause: error })
    );
}

/**
 * Delete deck
 */
export function deleteDeck(deckId: string): ResultAsync<void, DatabaseError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();

            // Delete deck media first
            await deleteDeckMedia(deckId);

            // Delete deck (cards will be deleted via cascade)
            await db.delete(decks).where(eq(decks.id, deckId));
        },
        (error) => new DatabaseError('Failed to delete deck', 'DELETE_DECK_FAILED', { cause: error })
    );
}

/**
 * Add cards to deck
 */
export function addCards(deckId: string, inputCards: ParsedCard[]): ResultAsync<Card[], DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    if (!inputCards?.length) {
        return errAsync(
            errorFactory.validation('At least one card must be provided', { field: 'cards' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const now = Date.now();
            const defaults = buildFsrsDefaults(now);

            const cardsToInsert = inputCards.map((card) => ({
                id: createId(),
                deckId,
                front: card.front.trim(),
                back: card.back.trim(),
                imageUrl: card.imageUrl ?? null,
                audioUrl: card.audioUrl ?? null,
                category: card.category ?? null,
                pos: card.pos ?? null,
                gender: card.gender ?? null,
                example: card.example ?? null,
                tags: serializeTags(card.tags),
                quiz: serializeQuiz(card.quiz),
                isStarred: 0,
                createdAt: now,
                updatedAt: now,
                due: defaults.due,
                stability: defaults.stability,
                difficulty: defaults.difficulty,
                elapsed_days: defaults.elapsed_days,
                scheduled_days: defaults.scheduled_days,
                learning_steps: defaults.learning_steps,
                reps: defaults.reps,
                lapses: defaults.lapses,
                state: defaults.state,
                lastReviewedAt: defaults.lastReviewedAt,
                learnState: 'not_studied',
                learnCorrectStreak: 0,
                learnCorrectTotal: 0,
                learnIncorrectTotal: 0,
                learnLastAnsweredAt: null,
            }));

            const result = await db.insert(cards).values(cardsToInsert).returning();
            return result.map(normalizeCard).filter((r) => r.isOk()).map((r) => r.value);
        },
        (error) => new DatabaseError('Failed to add cards', 'ADD_CARDS_FAILED', { cause: error })
    );
}

/**
 * Update card
 */
export function updateCard(
    cardId: string,
    updates: {
        front?: string;
        back?: string;
        imageUrl?: string | null;
        audioUrl?: string | null;
        category?: string | null;
        pos?: string | null;
        gender?: string | null;
        example?: string | null;
        tags?: string[];
        quiz?: QuizEnrichment | null;
        isStarred?: boolean;
    }
): ResultAsync<Card, DatabaseError | ValidationError> {
    if (!cardId) {
        return errAsync(
            errorFactory.validation('Card ID is required', { field: 'cardId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const now = Date.now();

            const values: Record<string, unknown> = {
                updatedAt: now,
            };

            if (updates.front) values.front = updates.front.trim();
            if (updates.back) values.back = updates.back.trim();
            if (updates.imageUrl !== undefined) values.imageUrl = updates.imageUrl;
            if (updates.audioUrl !== undefined) values.audioUrl = updates.audioUrl;
            if (updates.category !== undefined) values.category = updates.category;
            if (updates.pos !== undefined) values.pos = updates.pos;
            if (updates.gender !== undefined) values.gender = updates.gender;
            if (updates.example !== undefined) values.example = updates.example;
            if (updates.tags) values.tags = serializeTags(updates.tags);
            if (updates.quiz !== undefined) values.quiz = serializeQuiz(updates.quiz);
            if (updates.isStarred !== undefined) values.isStarred = updates.isStarred ? 1 : 0;

            const result = await db.update(cards)
                .set(values)
                .where(eq(cards.id, cardId))
                .returning();

            if (!result[0]) {
                throw new DatabaseError('Card not found', 'CARD_NOT_FOUND');
            }

            const normalized = normalizeCard(result[0]);
            if (normalized.isErr()) {
                throw normalized.error;
            }

            return normalized.value;
        },
        (error) => new DatabaseError('Failed to update card', 'UPDATE_CARD_FAILED', { cause: error })
    );
}

/**
 * Delete card
 */
export function deleteCard(cardId: string): ResultAsync<void, DatabaseError> {
    if (!cardId) {
        return errAsync(
            errorFactory.validation('Card ID is required', { field: 'cardId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();

            // Get card first to delete media
            const card = await db.query.cards.findFirst({
                where: eq(cards.id, cardId),
            });

            if (card) {
                // Delete media if local
                if (card.imageUrl) await deleteImageIfLocal(card.imageUrl);
                if (card.audioUrl) await deleteAudioIfLocal(card.audioUrl);

                // Delete card
                await db.delete(cards).where(eq(cards.id, cardId));
            }
        },
        (error) => new DatabaseError('Failed to delete card', 'DELETE_CARD_FAILED', { cause: error })
    );
}

// ============================================================================
// DECK OPERATIONS
// ============================================================================

/**
 * Update deck's last studied timestamp
 */
export function touchDeckStudied(deckId: string): ResultAsync<void, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const now = Date.now();
            await db.update(decks)
                .set({ lastStudiedAt: now, updatedAt: now })
                .where(eq(decks.id, deckId));
        },
        (error) => new DatabaseError('Failed to update deck studied timestamp', 'TOUCH_DECK_STUDIED_FAILED', { cause: error })
    );
}

/**
 * Swap front/back for all cards in a deck
 */
export function swapDeckCardSides(deckId: string): ResultAsync<void, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const now = Date.now();

            await db.update(cards)
                .set({
                    front: sql`back`,
                    back: sql`front`,
                    updatedAt: now,
                })
                .where(eq(cards.deckId, deckId));

            await db.update(decks)
                .set({ updatedAt: now })
                .where(eq(decks.id, deckId));
        },
        (error) => new DatabaseError('Failed to swap card sides', 'SWAP_DECK_CARD_SIDES_FAILED', { cause: error })
    );
}

// ============================================================================
// CARD LISTING & QUERYING
// ============================================================================

/**
 * List all cards in a deck
 */
export function listCards(deckId: string): ResultAsync<Card[], DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const cardRows = await db
                .select()
                .from(cards)
                .where(eq(cards.deckId, deckId))
                .orderBy(asc(cards.due), asc(cards.createdAt));

            return cardRows.map((card) => {
                const normalized = normalizeCard(card);
                if (normalized.isErr()) {
                    throw normalized.error;
                }
                return normalized.value;
            });
        },
        (error) => new DatabaseError('Failed to list cards', 'LIST_CARDS_FAILED', { cause: error })
    );
}

/**
 * Count cards in a deck
 */
export function countCards(deckId: string): ResultAsync<number, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const [row] = await db
                .select({ count: sql<number>`count(*)`.as('count') })
                .from(cards)
                .where(eq(cards.deckId, deckId));

            return Number(row?.count ?? 0);
        },
        (error) => new DatabaseError('Failed to count cards', 'COUNT_CARDS_FAILED', { cause: error })
    );
}

/**
 * Type for card preview (lightweight card object)
 */
export type CardPreview = Pick<Card, 'id' | 'front' | 'back' | 'isStarred' | 'audioUrl' | 'quiz'>;

/**
 * List card previews for a deck (limited)
 */
export function listCardPreviews(
    deckId: string,
    limit: number = 6
): ResultAsync<CardPreview[], DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    if (limit <= 0) {
        return okAsync([]);
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const rows = await db
                .select({
                    id: cards.id,
                    front: cards.front,
                    back: cards.back,
                    isStarred: cards.isStarred,
                    audioUrl: cards.audioUrl,
                    quiz: cards.quiz,
                })
                .from(cards)
                .where(eq(cards.deckId, deckId))
                .orderBy(asc(cards.due), asc(cards.createdAt))
                .limit(limit);

            return rows.map((row) => ({
                ...row,
                isStarred: row.isStarred === 1,
                quiz: parseQuiz(row.quiz),
            }));
        },
        (error) => new DatabaseError('Failed to list card previews', 'LIST_CARD_PREVIEWS_FAILED', { cause: error })
    );
}

/**
 * List random card samples from a deck
 */
export function listCardSamples(
    deckId: string,
    limit: number = 12
): ResultAsync<CardPreview[], DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    if (limit <= 0) {
        return okAsync([]);
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const rows = await db
                .select({
                    id: cards.id,
                    front: cards.front,
                    back: cards.back,
                    isStarred: cards.isStarred,
                    audioUrl: cards.audioUrl,
                    quiz: cards.quiz,
                })
                .from(cards)
                .where(eq(cards.deckId, deckId))
                .orderBy(sql`RANDOM()`)
                .limit(limit);

            return rows.map((row) => ({
                ...row,
                isStarred: row.isStarred === 1,
                quiz: parseQuiz(row.quiz),
            }));
        },
        (error) => new DatabaseError('Failed to list card samples', 'LIST_CARD_SAMPLES_FAILED', { cause: error })
    );
}

/**
 * List new cards in a deck
 */
export function listNewCards(
    deckId: string,
    limit: number = 20
): ResultAsync<Card[], DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    if (limit <= 0) {
        return okAsync([]);
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const cardRows = await db
                .select()
                .from(cards)
                .where(and(eq(cards.deckId, deckId), eq(cards.state, 'new')))
                .orderBy(asc(cards.createdAt))
                .limit(limit);

            return cardRows.map((card) => {
                const normalized = normalizeCard(card);
                if (normalized.isErr()) {
                    throw normalized.error;
                }
                return normalized.value;
            });
        },
        (error) => new DatabaseError('Failed to list new cards', 'LIST_NEW_CARDS_FAILED', { cause: error })
    );
}

/**
 * List due cards with pagination support
 */
export function listDueCardsPage(
    deckId: string,
    options?: {
        now?: number;
        limit?: number;
        cursor?: { due: number; createdAt: number };
    }
): ResultAsync<Card[], DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const now = options?.now ?? Date.now();
            const limit = options?.limit ?? 200;
            const cursor = options?.cursor;

            const baseFilter = and(eq(cards.deckId, deckId), lte(cards.due, now));
            const cursorFilter = cursor
                ? or(
                    gt(cards.due, cursor.due),
                    and(eq(cards.due, cursor.due), gt(cards.createdAt, cursor.createdAt))
                )
                : undefined;

            const cardRows = await db
                .select()
                .from(cards)
                .where(cursorFilter ? and(baseFilter, cursorFilter) : baseFilter)
                .orderBy(asc(cards.due), asc(cards.createdAt))
                .limit(limit);

            return cardRows.map((card) => {
                const normalized = normalizeCard(card);
                if (normalized.isErr()) {
                    throw normalized.error;
                }
                return normalized.value;
            });
        },
        (error) => new DatabaseError('Failed to list due cards', 'LIST_DUE_CARDS_PAGE_FAILED', { cause: error })
    );
}

/**
 * List upcoming cards (due in the future)
 */
export function listUpcomingCards(
    deckId: string,
    options?: { now?: number; limit?: number }
): ResultAsync<Card[], DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    const limit = options?.limit ?? 20;
    if (limit <= 0) {
        return okAsync([]);
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const now = options?.now ?? Date.now();

            const cardRows = await db
                .select()
                .from(cards)
                .where(and(eq(cards.deckId, deckId), gt(cards.due, now)))
                .orderBy(asc(cards.due), asc(cards.createdAt))
                .limit(limit);

            return cardRows.map((card) => {
                const normalized = normalizeCard(card);
                if (normalized.isErr()) {
                    throw normalized.error;
                }
                return normalized.value;
            });
        },
        (error) => new DatabaseError('Failed to list upcoming cards', 'LIST_UPCOMING_CARDS_FAILED', { cause: error })
    );
}

// ============================================================================
// SINGLE CARD OPERATIONS
// ============================================================================

/**
 * Create a single card
 */
export function createCard(
    deckId: string,
    cardData: {
        front: string;
        back: string;
        imageUrl?: string;
        audioUrl?: string;
        category?: string;
        pos?: string;
        gender?: string;
        example?: string;
        tags?: string[];
        quiz?: QuizEnrichment | null;
    }
): ResultAsync<string, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    if (!cardData.front?.trim()) {
        return errAsync(
            errorFactory.validation('Card front is required', { field: 'front' })
        );
    }

    if (!cardData.back?.trim()) {
        return errAsync(
            errorFactory.validation('Card back is required', { field: 'back' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const id = createId();
            const now = Date.now();
            const fsrs = buildFsrsDefaults(now);

            await db
                .insert(cards)
                .values({
                    id,
                    deckId,
                    front: cardData.front.trim(),
                    back: cardData.back.trim(),
                    imageUrl: cardData.imageUrl ?? null,
                    audioUrl: cardData.audioUrl ?? null,
                    category: cardData.category ?? null,
                    pos: cardData.pos ?? null,
                    gender: cardData.gender ?? null,
                    example: cardData.example ?? null,
                    tags: serializeTags(cardData.tags),
                    quiz: serializeQuiz(cardData.quiz),
                    createdAt: now,
                    updatedAt: now,
                    lastReviewedAt: fsrs.lastReviewedAt ?? null,
                    due: fsrs.due,
                    stability: fsrs.stability,
                    difficulty: fsrs.difficulty,
                    elapsed_days: fsrs.elapsed_days,
                    scheduled_days: fsrs.scheduled_days,
                    learning_steps: fsrs.learning_steps,
                    reps: fsrs.reps,
                    lapses: fsrs.lapses,
                    state: fsrs.state,
                });

            await db.update(decks).set({ updatedAt: now }).where(eq(decks.id, deckId));

            return id;
        },
        (error) => new DatabaseError('Failed to create card', 'CREATE_CARD_FAILED', { cause: error })
    );
}

// ============================================================================
// LEARN MODE OPERATIONS
// ============================================================================

/**
 * Type for familiarity estimate
 */
export type FamiliarityEstimate = {
    familiarity: LearnFamiliarity;
    score: number;
    averageRetrievability: number;
    newShare: number;
    reviewShare: number;
};

/**
 * Helper function to clamp values
 */
function clamp(value: number, min: number = 0, max: number = 1): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Estimate deck familiarity for learn mode
 */
export function estimateDeckFamiliarity(deckId: string): ResultAsync<FamiliarityEstimate, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const listResult = await listCards(deckId);
            if (listResult.isErr()) {
                throw listResult.error;
            }

            const cardList = listResult.value;
            const total = cardList.length;

            if (!total) {
                return {
                    familiarity: 'new',
                    score: 0,
                    averageRetrievability: 0,
                    newShare: 1,
                    reviewShare: 0,
                };
            }

            const now = Date.now();
            let scoreSum = 0;
            let retrievabilitySum = 0;
            let newCount = 0;
            let reviewCount = 0;

            cardList.forEach((card) => {
                const stateWeight =
                    card.state === 'new'
                        ? 0
                        : card.state === 'learning' || card.state === 'relearning'
                            ? 0.35
                            : 0.65;
                if (card.state === 'new') newCount += 1;
                if (card.state === 'review') reviewCount += 1;

                const retrievability = clamp(getCardRetrievability(card, now));
                retrievabilitySum += retrievability;

                const lapseRate = card.reps > 0 ? card.lapses / card.reps : 0;
                const lapsePenalty = Math.min(lapseRate * 0.2, 0.2);
                const score = clamp(stateWeight + retrievability * 0.35 - lapsePenalty);
                scoreSum += score;
            });

            const score = scoreSum / total;
            const averageRetrievability = retrievabilitySum / total;
            const newShare = newCount / total;
            const reviewShare = reviewCount / total;

            let familiarity: LearnFamiliarity = 'some';
            if (newShare >= 0.6 || score < 0.35) {
                familiarity = 'new';
            } else if (reviewShare >= 0.5 && score >= 0.7 && averageRetrievability >= 0.55) {
                familiarity = 'mostly';
            }

            return {
                familiarity,
                score,
                averageRetrievability,
                newShare,
                reviewShare,
            };
        },
        (error) => new DatabaseError('Failed to estimate deck familiarity', 'ESTIMATE_DECK_FAMILIARITY_FAILED', { cause: error })
    );
}

/**
 * Type for learn progress counts
 */
export type LearnProgressCounts = {
    notStudied: number;
    learning: number;
    mastered: number;
    total: number;
};

/**
 * Get learn mode progress counts
 */
export function getLearnProgressCounts(deckId: string): ResultAsync<LearnProgressCounts, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const [row] = await db
                .select({
                    total: sql<number>`count(*)`.as('total'),
                    learning: sql<number>`sum(CASE WHEN ${cards.learnState} = 'learning' THEN 1 ELSE 0 END)`.as('learning'),
                    mastered: sql<number>`sum(CASE WHEN ${cards.learnState} = 'mastered' THEN 1 ELSE 0 END)`.as('mastered'),
                })
                .from(cards)
                .where(eq(cards.deckId, deckId));

            const total = Number(row?.total ?? 0);
            const learning = Number(row?.learning ?? 0);
            const mastered = Number(row?.mastered ?? 0);
            const notStudied = Math.max(0, total - learning - mastered);

            return { total, learning, mastered, notStudied };
        },
        (error) => new DatabaseError('Failed to get learn progress counts', 'GET_LEARN_PROGRESS_COUNTS_FAILED', { cause: error })
    );
}

/**
 * Type for learn scope filter
 */
export type LearnScope = 'not_studied' | 'learning' | 'mastered' | 'all';

/**
 * List cards for learn mode
 */
export function listLearnCards(
    deckId: string,
    options: { scope?: LearnScope; starredOnly?: boolean } = {}
): ResultAsync<Card[], DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const scope = options.scope ?? 'all';

            const scopeFilter =
                scope === 'all'
                    ? undefined
                    : scope === 'not_studied'
                        ? or(isNull(cards.learnState), eq(cards.learnState, 'not_studied'))
                        : eq(cards.learnState, scope);

            const starredFilter = options.starredOnly ? eq(cards.isStarred, 1) : undefined;
            const whereClause = and(eq(cards.deckId, deckId), scopeFilter, starredFilter);

            const cardRows = await db
                .select()
                .from(cards)
                .where(whereClause)
                .orderBy(asc(cards.createdAt));

            return cardRows.map((card) => {
                const normalized = normalizeCard(card);
                if (normalized.isErr()) {
                    throw normalized.error;
                }
                return normalized.value;
            });
        },
        (error) => new DatabaseError('Failed to list learn cards', 'LIST_LEARN_CARDS_FAILED', { cause: error })
    );
}

/**
 * Set card starred status
 */
export function setCardStarred(cardId: string, isStarred: boolean): ResultAsync<void, DatabaseError | ValidationError> {
    if (!cardId) {
        return errAsync(
            errorFactory.validation('Card ID is required', { field: 'cardId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            await db.update(cards)
                .set({ isStarred: isStarred ? 1 : 0 })
                .where(eq(cards.id, cardId));
        },
        (error) => new DatabaseError('Failed to set card starred status', 'SET_CARD_STARRED_FAILED', { cause: error })
    );
}

/**
 * Reset learn mode progress for a deck
 */
export function resetLearnProgress(deckId: string): ResultAsync<void, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            await db
                .update(cards)
                .set({
                    learnState: null,
                    learnCorrectStreak: null,
                    learnCorrectTotal: null,
                    learnIncorrectTotal: null,
                    learnLastAnsweredAt: null,
                })
                .where(eq(cards.deckId, deckId));
        },
        (error) => new DatabaseError('Failed to reset learn progress', 'RESET_LEARN_PROGRESS_FAILED', { cause: error })
    );
}

/**
 * Record learn mode answer
 */
export function recordLearnAnswer(options: {
    cardId: string;
    deckId: string;
    correct: boolean;
    masteryStreak: number;
    now?: number;
    userId?: string | null;
}): ResultAsync<Card | null, DatabaseError | ValidationError> {
    if (!options.cardId) {
        return errAsync(
            errorFactory.validation('Card ID is required', { field: 'cardId' })
        );
    }

    if (!options.deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const now = options.now ?? Date.now();

            const [row] = await db
                .select({
                    learnState: cards.learnState,
                    learnCorrectStreak: cards.learnCorrectStreak,
                    learnCorrectTotal: cards.learnCorrectTotal,
                    learnIncorrectTotal: cards.learnIncorrectTotal,
                })
                .from(cards)
                .where(and(eq(cards.id, options.cardId), eq(cards.deckId, options.deckId)))
                .limit(1);

            if (!row) {
                return null;
            }

            const currentStreak = row.learnCorrectStreak ?? 0;
            const currentCorrect = row.learnCorrectTotal ?? 0;
            const currentIncorrect = row.learnIncorrectTotal ?? 0;

            const nextStreak = options.correct ? currentStreak + 1 : 0;
            const nextCorrect = currentCorrect + (options.correct ? 1 : 0);
            const nextIncorrect = currentIncorrect + (options.correct ? 0 : 1);

            let nextState: LearnState = normalizeLearnState(row.learnState);
            if (!options.correct) {
                nextState = 'learning';
            } else if (nextStreak >= options.masteryStreak) {
                nextState = 'mastered';
            } else {
                nextState = 'learning';
            }

            await db
                .update(cards)
                .set({
                    learnState: nextState,
                    learnCorrectStreak: nextStreak,
                    learnCorrectTotal: nextCorrect,
                    learnIncorrectTotal: nextIncorrect,
                    learnLastAnsweredAt: now,
                    updatedAt: now,
                })
                .where(and(eq(cards.id, options.cardId), eq(cards.deckId, options.deckId)));

            const [updated] = await db
                .select()
                .from(cards)
                .where(eq(cards.id, options.cardId))
                .limit(1);

            if (!updated) {
                return null;
            }

            const normalized = normalizeCard(updated);
            if (normalized.isErr()) {
                throw normalized.error;
            }
            const cardValue = normalized.value;

            const cardPayload = {
                id: cardValue.id,
                deckId: cardValue.deckId,
                front: cardValue.front,
                back: cardValue.back,
                imageUrl: cardValue.imageUrl,
                audioUrl: cardValue.audioUrl,
                category: cardValue.category,
                pos: cardValue.pos,
                gender: cardValue.gender,
                example: cardValue.example,
                tags: cardValue.tags,
                quiz: cardValue.quiz,
                isStarred: cardValue.isStarred,
                learnState: cardValue.learnState,
                learnCorrectStreak: cardValue.learnCorrectStreak,
                learnCorrectTotal: cardValue.learnCorrectTotal,
                learnIncorrectTotal: cardValue.learnIncorrectTotal,
                learnLastAnsweredAt: cardValue.learnLastAnsweredAt ? new Date(cardValue.learnLastAnsweredAt).toISOString() : null,
                createdAt: new Date(cardValue.createdAt).toISOString(),
                updatedAt: new Date(cardValue.updatedAt).toISOString(),
                lastReviewedAt: cardValue.lastReviewedAt ? new Date(cardValue.lastReviewedAt).toISOString() : null,
                due: cardValue.due ? new Date(cardValue.due).toISOString() : null,
                stability: cardValue.stability,
                difficulty: cardValue.difficulty,
                elapsed_days: cardValue.elapsed_days,
                scheduled_days: cardValue.scheduled_days,
                learning_steps: cardValue.learning_steps,
                reps: cardValue.reps,
                lapses: cardValue.lapses,
                state: cardValue.state,
                clientUpdatedAt: new Date(cardValue.updatedAt).toISOString(),
            };

            await enqueueSyncOperation({
                entityType: 'card',
                entityId: cardValue.id,
                operation: 'update',
                data: cardPayload,
                userId: options.userId ?? null,
            });

            return cardValue;
        },
        (error) => new DatabaseError('Failed to record learn answer', 'RECORD_LEARN_ANSWER_FAILED', { cause: error })
    );
}

// ============================================================================
// STUDY SESSION OPERATIONS
// ============================================================================

/**
 * Create a new study session
 */
export function createStudySession(deckId: string): ResultAsync<string, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const id = createId();
            const now = Date.now();

            await db.insert(studySessions).values({
                id,
                deckId,
                startedAt: now,
            });

            return id;
        },
        (error) => new DatabaseError('Failed to create study session', 'CREATE_STUDY_SESSION_FAILED', { cause: error })
    );
}

/**
 * Complete a study session
 */
export function completeStudySession(sessionId: string, userId?: string | null): ResultAsync<void, DatabaseError | ValidationError> {
    if (!sessionId) {
        return errAsync(
            errorFactory.validation('Session ID is required', { field: 'sessionId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();

            const [session] = await db
                .select({
                    startedAt: studySessions.startedAt,
                    endedAt: studySessions.endedAt,
                    deckId: studySessions.deckId,
                })
                .from(studySessions)
                .where(eq(studySessions.id, sessionId));

            if (!session) {
                throw new DatabaseError('Session not found', 'SESSION_NOT_FOUND');
            }

            if (session.endedAt) {
                // Session already completed
                return;
            }

            const now = Date.now();
            const durationMs = Math.max(0, now - (session.startedAt ?? now));

            await db
                .update(studySessions)
                .set({ endedAt: now, durationMs })
                .where(eq(studySessions.id, sessionId));

            const eventId = createId();
            await getStudyEventRepository().enqueueEvent('session', {
                id: eventId,
                deckId: session.deckId,
                sessionId,
                startedAt: new Date(session.startedAt ?? now).toISOString(),
                endedAt: new Date(now).toISOString(),
                durationMs,
                clientUpdatedAt: new Date(now).toISOString(),
            }, userId ?? null);
        },
        (error) => new DatabaseError('Failed to complete study session', 'COMPLETE_STUDY_SESSION_FAILED', { cause: error })
    );
}

/**
 * Log study result and update card
 */
export function logStudyResult(options: {
    card: Card;
    deckId: string;
    rating: Rating;
    sessionId?: string | null;
    responseMs?: number;
    userId?: string | null;
}): ResultAsync<Card, DatabaseError | ValidationError> {
    if (!options.card?.id) {
        return errAsync(
            errorFactory.validation('Card is required', { field: 'card' })
        );
    }

    if (!options.deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const result = scheduleReview(options.card, options.rating, Date.now());
            const now = result.log.review;

            await db.transaction(async (tx) => {
                await tx
                    .update(cards)
                    .set({
                        due: result.card.due,
                        stability: result.card.stability,
                        difficulty: result.card.difficulty,
                        elapsed_days: result.card.elapsed_days,
                        scheduled_days: result.card.scheduled_days,
                        learning_steps: result.card.learning_steps,
                        reps: result.card.reps,
                        lapses: result.card.lapses,
                        state: result.card.state,
                        lastReviewedAt: result.card.lastReviewedAt ?? null,
                        updatedAt: result.card.updatedAt,
                    })
                    .where(eq(cards.id, options.card.id));

                await tx
                    .insert(studyHistory)
                    .values({
                        id: createId(),
                        cardId: options.card.id,
                        deckId: options.deckId,
                        rating: result.log.rating,
                        state: result.log.state,
                        due: result.log.due,
                        stability: result.log.stability,
                        difficulty: result.log.difficulty,
                        elapsed_days: result.log.elapsed_days,
                        scheduled_days: result.log.scheduled_days,
                        createdAt: result.log.review,
                        sessionId: options.sessionId ?? null,
                    });

                await tx
                    .update(decks)
                    .set({ updatedAt: now, lastStudiedAt: now })
                    .where(eq(decks.id, options.deckId));
            });

            const reviewEventId = createId();
            const reviewedAt = new Date(result.log.review);
            await getStudyEventRepository().enqueueEvent('review', {
                id: reviewEventId,
                deckId: options.deckId,
                cardId: options.card.id,
                rating: result.log.rating,
                reviewedAt: reviewedAt.toISOString(),
                responseMs: options.responseMs ?? null,
                clientUpdatedAt: reviewedAt.toISOString(),
            }, options.userId ?? null);

            const cardPayload = {
                id: result.card.id,
                deckId: options.deckId,
                front: result.card.front,
                back: result.card.back,
                imageUrl: result.card.imageUrl,
                audioUrl: result.card.audioUrl,
                category: result.card.category,
                pos: result.card.pos,
                gender: result.card.gender,
                example: result.card.example,
                tags: result.card.tags,
                quiz: result.card.quiz,
                isStarred: result.card.isStarred,
                learnState: result.card.learnState,
                learnCorrectStreak: result.card.learnCorrectStreak,
                learnCorrectTotal: result.card.learnCorrectTotal,
                learnIncorrectTotal: result.card.learnIncorrectTotal,
                learnLastAnsweredAt: result.card.learnLastAnsweredAt ? new Date(result.card.learnLastAnsweredAt).toISOString() : null,
                createdAt: new Date(result.card.createdAt).toISOString(),
                updatedAt: new Date(result.card.updatedAt).toISOString(),
                lastReviewedAt: result.card.lastReviewedAt ? new Date(result.card.lastReviewedAt).toISOString() : null,
                due: result.card.due ? new Date(result.card.due).toISOString() : null,
                stability: result.card.stability,
                difficulty: result.card.difficulty,
                elapsed_days: result.card.elapsed_days,
                scheduled_days: result.card.scheduled_days,
                learning_steps: result.card.learning_steps,
                reps: result.card.reps,
                lapses: result.card.lapses,
                state: result.card.state,
                clientUpdatedAt: new Date(result.card.updatedAt).toISOString(),
            };

            await enqueueSyncOperation({
                entityType: 'card',
                entityId: result.card.id,
                operation: 'update',
                data: cardPayload,
                userId: options.userId ?? null,
            });

            return result.card;
        },
        (error) => new DatabaseError('Failed to log study result', 'LOG_STUDY_RESULT_FAILED', { cause: error })
    );
}

// ============================================================================
// ANALYTICS & STATS
// ============================================================================

/**
 * Type for deck stats
 */
export type DeckStats = {
    totalCount: number;
    dueCount: number;
    newCount: number;
    learningCount: number;
    reviewCount: number;
    relearningCount: number;
    retention: number;
};

/**
 * Get deck statistics
 */
export function getDeckStats(deckId: string): ResultAsync<DeckStats, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const endOfToday = new Date();
            endOfToday.setHours(23, 59, 59, 999);

            const [row] = await db
                .select({
                    total: sql<number>`count(*)`.as('total'),
                    dueCount: sql<number>`sum(CASE WHEN ${cards.due} <= ${endOfToday.getTime()} THEN 1 ELSE 0 END)`.as('dueCount'),
                    newCount: sql<number>`sum(CASE WHEN ${cards.state} = 'new' THEN 1 ELSE 0 END)`.as('newCount'),
                    learningCount: sql<number>`sum(CASE WHEN ${cards.state} = 'learning' THEN 1 ELSE 0 END)`.as('learningCount'),
                    reviewCount: sql<number>`sum(CASE WHEN ${cards.state} = 'review' THEN 1 ELSE 0 END)`.as('reviewCount'),
                    relearningCount: sql<number>`sum(CASE WHEN ${cards.state} = 'relearning' THEN 1 ELSE 0 END)`.as('relearningCount'),
                })
                .from(cards)
                .where(eq(cards.deckId, deckId));

            const [retentionRow] = await db
                .select({
                    retention: sql<number>`avg(CASE WHEN ${studyHistory.rating} = ${Rating.Again} THEN 0 ELSE 1 END)`.as('retention'),
                })
                .from(studyHistory)
                .where(eq(studyHistory.deckId, deckId));

            return {
                totalCount: Number(row?.total ?? 0),
                dueCount: Number(row?.dueCount ?? 0),
                newCount: Number(row?.newCount ?? 0),
                learningCount: Number(row?.learningCount ?? 0),
                reviewCount: Number(row?.reviewCount ?? 0),
                relearningCount: Number(row?.relearningCount ?? 0),
                retention: Number(retentionRow?.retention ?? 1),
            };
        },
        (error) => new DatabaseError('Failed to get deck stats', 'GET_DECK_STATS_FAILED', { cause: error })
    );
}

/**
 * Type for today's study counts
 */
export type TodayStudyCounts = {
    reviewCount: number;
    newCount: number;
};

/**
 * Get today's study counts
 */
export function getTodayStudyCounts(
    deckId: string,
    now: number = Date.now()
): ResultAsync<TodayStudyCounts, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const startOfToday = new Date(now);
            startOfToday.setHours(0, 0, 0, 0);
            const startTime = startOfToday.getTime();

            const [reviewRow] = await db
                .select({ count: sql<number>`count(*)`.as('count') })
                .from(studyHistory)
                .where(and(eq(studyHistory.deckId, deckId), gte(studyHistory.createdAt, startTime)));

            const [newRow] = await db
                .select({ count: sql<number>`count(*)`.as('count') })
                .from(studyHistory)
                .where(
                    and(
                        eq(studyHistory.deckId, deckId),
                        eq(studyHistory.state, 'new'),
                        gte(studyHistory.createdAt, startTime)
                    )
                );

            return {
                reviewCount: Number(reviewRow?.count ?? 0),
                newCount: Number(newRow?.count ?? 0),
            };
        },
        (error) => new DatabaseError('Failed to get today study counts', 'GET_TODAY_STUDY_COUNTS_FAILED', { cause: error })
    );
}

/**
 * Reset all progress for a deck
 */
export function resetDeckProgress(deckId: string): ResultAsync<void, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const now = Date.now();
            const fsrs = buildFsrsDefaults(now);

            await db.transaction(async (tx) => {
                await tx
                    .update(cards)
                    .set({
                        lastReviewedAt: null,
                        due: fsrs.due,
                        stability: fsrs.stability,
                        difficulty: fsrs.difficulty,
                        elapsed_days: fsrs.elapsed_days,
                        scheduled_days: fsrs.scheduled_days,
                        learning_steps: fsrs.learning_steps,
                        reps: fsrs.reps,
                        lapses: fsrs.lapses,
                        state: fsrs.state,
                        updatedAt: now,
                    })
                    .where(eq(cards.deckId, deckId));

                await tx.delete(studyHistory).where(eq(studyHistory.deckId, deckId));
                await tx.delete(studySessions).where(eq(studySessions.deckId, deckId));

                await tx
                    .update(decks)
                    .set({ lastStudiedAt: null, updatedAt: now })
                    .where(eq(decks.id, deckId));
            });
        },
        (error) => new DatabaseError('Failed to reset deck progress', 'RESET_DECK_PROGRESS_FAILED', { cause: error })
    );
}

/**
 * Get comprehensive deck analytics
 */
export function getDeckAnalytics(
    deckId: string,
    windowDays: number = 30
): ResultAsync<DeckAnalytics, DatabaseError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        async () => {
            const db = await getDb();
            const getUtcDateKey = (date: Date) => date.toISOString().slice(0, 10);
            const now = new Date();
            const endOfToday = new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
            );
            const startWindow = windowDays > 0 ? endOfToday.getTime() - windowDays * 24 * 60 * 60 * 1000 : 0;
            const forecastEnd = endOfToday.getTime() + 14 * 24 * 60 * 60 * 1000;

            const statsResult = await getDeckStats(deckId);
            if (statsResult.isErr()) {
                throw statsResult.error;
            }

            const totals = statsResult.value;

            const [easeRow] = await db
                .select({
                    bucket1: sql<number>`sum(CASE WHEN ${cards.difficulty} < 2 THEN 1 ELSE 0 END)`.as('bucket1'),
                    bucket2: sql<number>`sum(CASE WHEN ${cards.difficulty} >= 2 AND ${cards.difficulty} < 4 THEN 1 ELSE 0 END)`.as('bucket2'),
                    bucket3: sql<number>`sum(CASE WHEN ${cards.difficulty} >= 4 AND ${cards.difficulty} < 6 THEN 1 ELSE 0 END)`.as('bucket3'),
                    bucket4: sql<number>`sum(CASE WHEN ${cards.difficulty} >= 6 AND ${cards.difficulty} < 8 THEN 1 ELSE 0 END)`.as('bucket4'),
                    bucket5: sql<number>`sum(CASE WHEN ${cards.difficulty} >= 8 THEN 1 ELSE 0 END)`.as('bucket5'),
                })
                .from(cards)
                .where(eq(cards.deckId, deckId));

            const history = await db
                .select({ createdAt: studyHistory.createdAt, rating: studyHistory.rating })
                .from(studyHistory)
                .where(and(eq(studyHistory.deckId, deckId), gte(studyHistory.createdAt, startWindow)));

            const ratingRows = await db
                .select({ rating: studyHistory.rating, count: sql<number>`count(*)` })
                .from(studyHistory)
                .where(eq(studyHistory.deckId, deckId))
                .groupBy(studyHistory.rating);

            const sessionRows = await db
                .select({
                    startedAt: studySessions.startedAt,
                    endedAt: studySessions.endedAt,
                    durationMs: studySessions.durationMs,
                })
                .from(studySessions)
                .where(and(eq(studySessions.deckId, deckId), gte(studySessions.startedAt, startWindow)));

            const dueRows = await db
                .select({ due: cards.due })
                .from(cards)
                .where(
                    and(
                        eq(cards.deckId, deckId),
                        isNotNull(cards.due),
                        lte(cards.due, forecastEnd),
                        gte(cards.due, endOfToday.getTime())
                    )
                );

            const easeBuckets = [
                { bucket: '1-2', count: Number(easeRow?.bucket1 ?? 0) },
                { bucket: '2-4', count: Number(easeRow?.bucket2 ?? 0) },
                { bucket: '4-6', count: Number(easeRow?.bucket3 ?? 0) },
                { bucket: '6-8', count: Number(easeRow?.bucket4 ?? 0) },
                { bucket: '8-10', count: Number(easeRow?.bucket5 ?? 0) },
            ];

            const dayMap: Record<string, { total: number; passed: number }> = {};
            let earliestDayStart: number | null = null;

            history.forEach((row) => {
                const date = new Date(row.createdAt);
                const key = getUtcDateKey(date);
                const dayStart = Date.parse(`${key}T00:00:00Z`);
                if (earliestDayStart === null || dayStart < earliestDayStart) {
                    earliestDayStart = dayStart;
                }
                if (!dayMap[key]) dayMap[key] = { total: 0, passed: 0 };
                dayMap[key].total += 1;
                if (row.rating !== Rating.Again) {
                    dayMap[key].passed += 1;
                }
            });

            let spanDays = windowDays;
            if (windowDays === 0) {
                if (earliestDayStart !== null) {
                    spanDays = Math.max(1, Math.round((endOfToday.getTime() - earliestDayStart) / (24 * 60 * 60 * 1000)) + 1);
                } else {
                    spanDays = 30;
                }
            }

            const dailyHistory: { date: string; total: number; passed: number }[] = [];
            for (let i = spanDays - 1; i >= 0; i -= 1) {
                const day = new Date(endOfToday.getTime() - i * 24 * 60 * 60 * 1000);
                const key = getUtcDateKey(day);
                const entry = dayMap[key] ?? { total: 0, passed: 0 };
                dailyHistory.push({ date: key, total: entry.total, passed: entry.passed });
            }

            const retention =
                history.length > 0
                    ? history.filter((h) => h.rating !== Rating.Again).length / history.length
                    : totals.retention;

            const ratingCounts = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((rating) => ({
                rating,
                count: Number(ratingRows.find((r) => r.rating === rating)?.count ?? 0),
            }));

            const dueMap: Record<string, number> = {};
            for (const row of dueRows) {
                if (row.due == null) continue;
                const key = getUtcDateKey(new Date(row.due));
                dueMap[key] = (dueMap[key] ?? 0) + 1;
            }

            const dueForecast: { date: string; count: number }[] = [];
            for (let i = 0; i <= 14; i += 1) {
                const day = new Date(endOfToday.getTime() + i * 24 * 60 * 60 * 1000);
                const key = getUtcDateKey(day);
                dueForecast.push({ date: key, count: dueMap[key] ?? 0 });
            }

            const timeMap: Record<string, number> = {};
            sessionRows.forEach((row) => {
                if (!row.startedAt) return;
                const start = Number(row.startedAt);
                const end = Number(row.endedAt ?? row.startedAt);
                const durationMs = row.durationMs ?? Math.max(0, end - start);
                if (!Number.isFinite(durationMs) || durationMs <= 0) return;
                const key = getUtcDateKey(new Date(end));
                timeMap[key] = (timeMap[key] ?? 0) + durationMs / 60000;
            });

            const timeSpent: { date: string; minutes: number }[] = [];
            for (let i = spanDays - 1; i >= 0; i -= 1) {
                const day = new Date(endOfToday.getTime() - i * 24 * 60 * 60 * 1000);
                const key = getUtcDateKey(day);
                const minutes = timeMap[key] ?? 0;
                timeSpent.push({ date: key, minutes: Math.round(minutes * 10) / 10 });
            }

            return {
                totals: {
                    total: totals.totalCount,
                    dueToday: totals.dueCount,
                    newCount: totals.newCount,
                    learningCount: totals.learningCount,
                    reviewCount: totals.reviewCount,
                    relearningCount: totals.relearningCount,
                },
                retention,
                easeBuckets,
                dailyHistory,
                ratingCounts,
                dueForecast,
                timeSpent,
                windowDaysUsed: spanDays,
            };
        },
        (error) => new DatabaseError('Failed to get deck analytics', 'GET_DECK_ANALYTICS_FAILED', { cause: error })
    );
}

// ============================================================================
// SYNC APPLY HELPERS
// ============================================================================

function parseTimestamp(value?: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value instanceof Date) return Number.isFinite(value.valueOf()) ? value.valueOf() : null;
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.valueOf()) ? parsed.valueOf() : null;
}

function normalizeTagsInput(value?: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    if (typeof value !== 'string') return [];
    return parseTags(value).unwrapOr([]);
}

function normalizeNullableStringInput(value: unknown): string | null {
    if (value === null) return null;
    if (value === undefined) return null;
    return String(value);
}

function normalizeVisibility(value: unknown, fallback: 'private' | 'public'): 'private' | 'public' {
    if (value === 'private' || value === 'public') {
        return value;
    }
    return fallback;
}

export function deckExists(deckId: string): ResultAsync<boolean, DatabaseError> {
    if (!deckId) {
        return okAsync(false);
    }
    return safeAsync(
        async () => {
            const db = await getDb();
            const [row] = await db
                .select({ id: decks.id })
                .from(decks)
                .where(eq(decks.id, deckId))
                .limit(1);
            return Boolean(row?.id);
        },
        (error) => new DatabaseError('Failed to check deck existence', 'DECK_EXISTS_FAILED', { cause: error })
    );
}

export function upsertDeckFromSync(payload: Record<string, unknown>): ResultAsync<void, DatabaseError> {
    return safeAsync(
        async () => {
            const db = await getDb();
            const id = String(payload.id ?? '');
            if (!id) return;

            const incomingUpdatedAt = parseTimestamp(payload.updatedAt) ?? Date.now();

            const existing = await db.query.decks.findFirst({
                where: eq(decks.id, id),
            });

            if (existing) {
                const localUpdatedAt = Number(existing.updatedAt ?? 0);
                if (incomingUpdatedAt <= localUpdatedAt) return;

                await db.update(decks)
                    .set({
                        name: payload.name ? String(payload.name).trim() : existing.name,
                        description: payload.description !== undefined
                            ? payload.description === null
                                ? null
                                : String(payload.description)
                            : existing.description,
                        accentKey: payload.accentKey !== undefined ? normalizeNullableStringInput(payload.accentKey) : existing.accentKey,
                        materialType: payload.materialType !== undefined ? normalizeNullableStringInput(payload.materialType) : existing.materialType,
                        deckType: payload.deckType !== undefined ? normalizeNullableStringInput(payload.deckType) : existing.deckType,
                        locale: payload.locale !== undefined ? normalizeNullableStringInput(payload.locale) : existing.locale,
                        visibility: payload.visibility !== undefined
                            ? normalizeVisibility(payload.visibility, existing.visibility ?? 'private')
                            : existing.visibility,
                        isFeatured: payload.isFeatured !== undefined ? Boolean(payload.isFeatured) : existing.isFeatured,
                        downloadCount: payload.downloadCount !== undefined ? Number(payload.downloadCount) : existing.downloadCount,
                        viewCount: payload.viewCount !== undefined ? Number(payload.viewCount) : existing.viewCount,
                        syncStatus: 'synced',
                        serverDeckId: id,
                        lastSyncedAt: Date.now(),
                        updatedAt: incomingUpdatedAt,
                        lastStudiedAt: parseTimestamp(payload.lastStudiedAt),
                    })
                    .where(eq(decks.id, id));
                return;
            }

            const createdAt = parseTimestamp(payload.createdAt) ?? incomingUpdatedAt;

            await db.insert(decks).values({
                id,
                userId: payload.userId ? String(payload.userId) : null,
                name: payload.name ? String(payload.name).trim() : 'Untitled',
                description: payload.description == null ? null : String(payload.description),
                accentKey: payload.accentKey ? String(payload.accentKey) : DEFAULT_DECK_ACCENT_KEY,
                materialType: payload.materialType ? String(payload.materialType) : null,
                deckType: payload.deckType ? String(payload.deckType) : null,
                locale: payload.locale ? String(payload.locale) : null,
                visibility: normalizeVisibility(payload.visibility, 'private'),
                isFeatured: Boolean(payload.isFeatured ?? false),
                downloadCount: Number(payload.downloadCount ?? 0),
                viewCount: Number(payload.viewCount ?? 0),
                syncStatus: 'synced',
                serverDeckId: id,
                lastSyncedAt: Date.now(),
                version: 1,
                createdAt,
                updatedAt: incomingUpdatedAt,
                lastStudiedAt: parseTimestamp(payload.lastStudiedAt),
            });
        },
        (error) => new DatabaseError('Failed to upsert deck from sync', 'UPSERT_DECK_SYNC_FAILED', { cause: error })
    );
}

export function upsertCardFromSync(payload: Record<string, unknown>): ResultAsync<void, DatabaseError> {
    return safeAsync(
        async () => {
            const db = await getDb();
            const id = String(payload.id ?? '');
            const deckId = String(payload.deckId ?? '');
            if (!id || !deckId) return;

            const incomingUpdatedAt = parseTimestamp(payload.updatedAt) ?? Date.now();

            const existing = await db.query.cards.findFirst({
                where: eq(cards.id, id),
            });

            if (existing) {
                const localUpdatedAt = Number(existing.updatedAt ?? 0);
                if (incomingUpdatedAt <= localUpdatedAt) return;

                await db.update(cards)
                    .set({
                        deckId,
                        front: payload.front ? String(payload.front).trim() : existing.front,
                        back: payload.back ? String(payload.back).trim() : existing.back,
                        imageUrl: payload.imageUrl !== undefined ? normalizeNullableStringInput(payload.imageUrl) : existing.imageUrl,
                        audioUrl: payload.audioUrl !== undefined ? normalizeNullableStringInput(payload.audioUrl) : existing.audioUrl,
                        category: payload.category !== undefined ? normalizeNullableStringInput(payload.category) : existing.category,
                        pos: payload.pos !== undefined ? normalizeNullableStringInput(payload.pos) : existing.pos,
                        gender: payload.gender !== undefined ? normalizeNullableStringInput(payload.gender) : existing.gender,
                        example: payload.example !== undefined ? normalizeNullableStringInput(payload.example) : existing.example,
                        tags: serializeTags(normalizeTagsInput(payload.tags)),
                        quiz: payload.quiz !== undefined ? serializeQuiz(payload.quiz) : existing.quiz,
                        isStarred: payload.isStarred !== undefined ? (payload.isStarred ? 1 : 0) : existing.isStarred,
                        learnState: payload.learnState !== undefined ? normalizeNullableStringInput(payload.learnState) : existing.learnState,
                        learnCorrectStreak: payload.learnCorrectStreak !== undefined ? Number(payload.learnCorrectStreak) : existing.learnCorrectStreak,
                        learnCorrectTotal: payload.learnCorrectTotal !== undefined ? Number(payload.learnCorrectTotal) : existing.learnCorrectTotal,
                        learnIncorrectTotal: payload.learnIncorrectTotal !== undefined ? Number(payload.learnIncorrectTotal) : existing.learnIncorrectTotal,
                        learnLastAnsweredAt: parseTimestamp(payload.learnLastAnsweredAt),
                        lastReviewedAt: parseTimestamp(payload.lastReviewedAt),
                        due: parseTimestamp(payload.due),
                        stability: payload.stability !== undefined ? Number(payload.stability) : existing.stability,
                        difficulty: payload.difficulty !== undefined ? Number(payload.difficulty) : existing.difficulty,
                        elapsed_days: payload.elapsed_days !== undefined ? Number(payload.elapsed_days) : existing.elapsed_days,
                        scheduled_days: payload.scheduled_days !== undefined ? Number(payload.scheduled_days) : existing.scheduled_days,
                        learning_steps: payload.learning_steps !== undefined ? Number(payload.learning_steps) : existing.learning_steps,
                        reps: payload.reps !== undefined ? Number(payload.reps) : existing.reps,
                        lapses: payload.lapses !== undefined ? Number(payload.lapses) : existing.lapses,
                        state: payload.state !== undefined ? String(payload.state) : existing.state,
                        updatedAt: incomingUpdatedAt,
                    })
                    .where(eq(cards.id, id));
                return;
            }

            const createdAt = parseTimestamp(payload.createdAt) ?? incomingUpdatedAt;

            await db.insert(cards).values({
                id,
                deckId,
                front: payload.front ? String(payload.front).trim() : '',
                back: payload.back ? String(payload.back).trim() : '',
                imageUrl: payload.imageUrl ? String(payload.imageUrl) : null,
                audioUrl: payload.audioUrl ? String(payload.audioUrl) : null,
                category: payload.category ? String(payload.category) : null,
                pos: payload.pos ? String(payload.pos) : null,
                gender: payload.gender ? String(payload.gender) : null,
                example: payload.example ? String(payload.example) : null,
                tags: serializeTags(normalizeTagsInput(payload.tags)),
                quiz: serializeQuiz(payload.quiz),
                isStarred: payload.isStarred ? 1 : 0,
                learnState: payload.learnState ? String(payload.learnState) : null,
                learnCorrectStreak: payload.learnCorrectStreak !== undefined ? Number(payload.learnCorrectStreak) : null,
                learnCorrectTotal: payload.learnCorrectTotal !== undefined ? Number(payload.learnCorrectTotal) : null,
                learnIncorrectTotal: payload.learnIncorrectTotal !== undefined ? Number(payload.learnIncorrectTotal) : null,
                learnLastAnsweredAt: parseTimestamp(payload.learnLastAnsweredAt),
                createdAt,
                updatedAt: incomingUpdatedAt,
                lastReviewedAt: parseTimestamp(payload.lastReviewedAt),
                due: parseTimestamp(payload.due),
                stability: payload.stability !== undefined ? Number(payload.stability) : null,
                difficulty: payload.difficulty !== undefined ? Number(payload.difficulty) : null,
                elapsed_days: payload.elapsed_days !== undefined ? Number(payload.elapsed_days) : null,
                scheduled_days: payload.scheduled_days !== undefined ? Number(payload.scheduled_days) : null,
                learning_steps: payload.learning_steps !== undefined ? Number(payload.learning_steps) : null,
                reps: payload.reps !== undefined ? Number(payload.reps) : null,
                lapses: payload.lapses !== undefined ? Number(payload.lapses) : null,
                state: payload.state ? String(payload.state) : null,
            });
        },
        (error) => new DatabaseError('Failed to upsert card from sync', 'UPSERT_CARD_SYNC_FAILED', { cause: error })
    );
}

export function applyDeckDeleteFromSync(deckId: string): ResultAsync<void, DatabaseError> {
    return safeAsync(
        async () => {
            const db = await getDb();
            await db.delete(decks).where(eq(decks.id, deckId));
        },
        (error) => new DatabaseError('Failed to delete deck from sync', 'DELETE_DECK_SYNC_FAILED', { cause: error })
    );
}

export function applyCardDeleteFromSync(cardId: string): ResultAsync<void, DatabaseError> {
    return safeAsync(
        async () => {
            const db = await getDb();
            await db.delete(cards).where(eq(cards.id, cardId));
        },
        (error) => new DatabaseError('Failed to delete card from sync', 'DELETE_CARD_SYNC_FAILED', { cause: error })
    );
}
