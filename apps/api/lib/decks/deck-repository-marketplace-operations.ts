import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { ResultAsync } from 'neverthrow';
import { errAsync } from 'neverthrow';
import {
    createId,
    errorFactory,
    type DatabaseError,
    NotFoundError,
    safeAsync,
    safeValidate,
    type ValidationError,
} from '@flashly/shared';
import { db } from '../../db/db.ts';
import { cards, deckClones, decks, syncChanges } from '../auth/auth-schema.ts';
import { MarketplaceQuerySchema, type MarketplaceQuery } from './deck-schema.ts';
import {
    buildCardPayload,
    buildDeckPayload,
    type Card,
    type DeckWithCards,
    type DeckWithStats,
    type PaginatedDecks,
} from './deck-repository-shared.ts';

export function listMarketplaceDecksOperation(query: MarketplaceQuery): ResultAsync<PaginatedDecks, DatabaseError | ValidationError> {
    const validationResult = safeValidate(MarketplaceQuerySchema, query);
    if (validationResult.isErr()) {
        return errAsync(validationResult.error);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    return safeAsync(
        (async () => {
            const conditions = [eq(decks.visibility, 'public')];

            if (query.materialType) {
                conditions.push(eq(decks.materialType, query.materialType));
            }

            if (query.deckType) {
                conditions.push(eq(decks.deckType, query.deckType));
            }

            if (query.locale) {
                conditions.push(eq(decks.locale, query.locale));
            }

            if (query.level) {
                conditions.push(sql`${decks.marketplaceMetadata}->>'level' = ${query.level}`);
            }

            if (query.skill) {
                conditions.push(sql`COALESCE((${decks.marketplaceMetadata})::jsonb->'skills', '[]'::jsonb) ? ${query.skill}`);
            }

            if (query.regionalVariant) {
                conditions.push(sql`${decks.marketplaceMetadata}->>'regionalVariant' = ${query.regionalVariant}`);
            }

            if (query.script) {
                conditions.push(sql`${decks.marketplaceMetadata}->>'script' = ${query.script}`);
            }

            if (query.romanization) {
                conditions.push(sql`${decks.marketplaceMetadata}->>'romanization' = ${query.romanization}`);
            }

            if (query.licenseCode) {
                conditions.push(sql`${decks.marketplaceMetadata}->'license'->>'code' = ${query.licenseCode}`);
            }

            if (query.hasAudio !== undefined) {
                const hasAudioCondition = sql`EXISTS (
                    SELECT 1
                    FROM ${cards}
                    WHERE ${cards.deckId} = ${decks.id}
                    AND ${cards.audioUrl} IS NOT NULL
                    AND ${cards.audioUrl} <> ''
                )`;
                if (query.hasAudio) {
                    conditions.push(hasAudioCondition);
                } else {
                    conditions.push(sql`NOT (${hasAudioCondition})`);
                }
            }

            if (query.search) {
                const searchPattern = `%${query.search}%`;
                const searchCondition = or(
                    ilike(decks.name, searchPattern),
                    ilike(decks.description, searchPattern)
                );
                if (searchCondition) {
                    conditions.push(searchCondition);
                }
            }

            const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

            const sortBy = query.sortBy ?? 'newest';
            const sortOrder = query.sortOrder ?? (sortBy === 'name' ? 'asc' : 'desc');
            const sortDirection = sortOrder === 'asc' ? asc : desc;
            const sortColumn = (() => {
                switch (sortBy) {
                    case 'most_downloaded':
                    case 'downloadCount':
                        return decks.downloadCount;
                    case 'most_viewed':
                    case 'viewCount':
                        return decks.viewCount;
                    case 'updated':
                        return decks.updatedAt;
                    case 'name':
                        return decks.name;
                    case 'created':
                    case 'newest':
                    default:
                        return decks.createdAt;
                }
            })();

            const [countResult] = await db
                .select({ count: count() })
                .from(decks)
                .where(whereClause);

            const total = countResult?.count ?? 0;
            const totalPages = Math.ceil(total / limit);

            const deckRows = await db
                .select({
                    id: decks.id,
                    userId: decks.userId,
                    name: decks.name,
                    description: decks.description,
                    accentKey: decks.accentKey,
                    materialType: decks.materialType,
                    deckType: decks.deckType,
                    locale: decks.locale,
                    marketplaceMetadata: decks.marketplaceMetadata,
                    visibility: decks.visibility,
                    isFeatured: decks.isFeatured,
                    downloadCount: decks.downloadCount,
                    viewCount: decks.viewCount,
                    lastSyncedAt: decks.lastSyncedAt,
                    createdAt: decks.createdAt,
                    updatedAt: decks.updatedAt,
                    lastStudiedAt: decks.lastStudiedAt,
                    isTemplate: decks.isTemplate,
                    templateId: decks.templateId,
                    templateData: decks.templateData,
                    cardCount: count(cards.id),
                })
                .from(decks)
                .leftJoin(cards, eq(decks.id, cards.deckId))
                .where(whereClause)
                .groupBy(decks.id)
                .orderBy(
                    desc(decks.isFeatured),
                    sortDirection(sortColumn),
                    desc(decks.createdAt)
                )
                .limit(limit)
                .offset(offset);

            const items: DeckWithStats[] = deckRows.map((row) => ({
                ...row,
                cardCount: Number(row.cardCount ?? 0),
                downloadCount: Number(row.downloadCount ?? 0),
                viewCount: Number(row.viewCount ?? 0),
            }));

            return {
                items,
                total,
                page,
                limit,
                totalPages,
                hasMore: page < totalPages,
            };
        })(),
        (error) => errorFactory.database('Failed to list marketplace decks', { cause: error })
    );
}

export function getFeaturedDecksOperation(limit: number = 10): ResultAsync<DeckWithStats[], DatabaseError> {
    return safeAsync(
        (async () => {
            const deckRows = await db
                .select({
                    id: decks.id,
                    userId: decks.userId,
                    name: decks.name,
                    description: decks.description,
                    accentKey: decks.accentKey,
                    materialType: decks.materialType,
                    deckType: decks.deckType,
                    locale: decks.locale,
                    marketplaceMetadata: decks.marketplaceMetadata,
                    visibility: decks.visibility,
                    isFeatured: decks.isFeatured,
                    downloadCount: decks.downloadCount,
                    viewCount: decks.viewCount,
                    lastSyncedAt: decks.lastSyncedAt,
                    createdAt: decks.createdAt,
                    updatedAt: decks.updatedAt,
                    lastStudiedAt: decks.lastStudiedAt,
                    isTemplate: decks.isTemplate,
                    templateId: decks.templateId,
                    templateData: decks.templateData,
                    cardCount: count(cards.id),
                })
                .from(decks)
                .leftJoin(cards, eq(decks.id, cards.deckId))
                .where(and(eq(decks.visibility, 'public'), eq(decks.isFeatured, true)))
                .groupBy(decks.id)
                .orderBy(desc(decks.downloadCount), desc(decks.createdAt))
                .limit(limit);

            const items: DeckWithStats[] = deckRows.map((row) => ({
                ...row,
                cardCount: Number(row.cardCount ?? 0),
                downloadCount: Number(row.downloadCount ?? 0),
                viewCount: Number(row.viewCount ?? 0),
            }));

            return items;
        })(),
        (error) => errorFactory.database('Failed to get featured decks', { cause: error })
    );
}

export function cloneDeckOperation(
    deckId: string,
    userId: string
): ResultAsync<DeckWithCards, DatabaseError | NotFoundError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    if (!userId) {
        return errAsync(
            errorFactory.validation('User ID is required', { field: 'userId' })
        );
    }

    return safeAsync(
        (async () => {
            const originalDeck = await db.query.decks.findFirst({
                where: and(
                    eq(decks.id, deckId),
                    eq(decks.visibility, 'public')
                ),
                with: {
                    cards: true,
                },
            });

            if (!originalDeck) {
                throw errorFactory.notFound('Deck not found');
            }

            if (originalDeck.userId === userId) {
                return originalDeck;
            }

            const [existingClone] = await db
                .select({
                    clonedDeckId: deckClones.clonedDeckId,
                })
                .from(deckClones)
                .where(and(eq(deckClones.originalDeckId, deckId), eq(deckClones.userId, userId)))
                .orderBy(desc(deckClones.createdAt))
                .limit(1);

            if (existingClone?.clonedDeckId) {
                const clonedDeck = await db.query.decks.findFirst({
                    where: eq(decks.id, existingClone.clonedDeckId),
                    with: {
                        cards: true,
                    },
                });

                if (clonedDeck) {
                    return clonedDeck;
                }
            }

            const now = new Date();
            const clonedDeckId = createId();

            await db.transaction(async (tx) => {
                const [insertedDeck] = await tx.insert(decks).values({
                    id: clonedDeckId,
                    userId,
                    name: originalDeck.name,
                    description: originalDeck.description,
                    accentKey: originalDeck.accentKey,
                    materialType: originalDeck.materialType,
                    deckType: originalDeck.deckType,
                    locale: originalDeck.locale,
                    marketplaceMetadata: originalDeck.marketplaceMetadata,
                    visibility: 'private',
                    isFeatured: false,
                    downloadCount: 0,
                    viewCount: 0,
                    lastSyncedAt: null,
                    createdAt: now,
                    updatedAt: now,
                    lastStudiedAt: null,
                }).returning();
                if (!insertedDeck) {
                    throw errorFactory.database('Failed to create cloned deck');
                }

                let insertedCards: Card[] = [];
                const deckCards = originalDeck.cards ?? [];
                if (deckCards.length > 0) {
                    const cardsToInsert = deckCards.map((card) => ({
                        id: createId(),
                        deckId: clonedDeckId,
                        front: card.front,
                        back: card.back,
                        imageUrl: card.imageUrl,
                        audioUrl: card.audioUrl,
                        category: card.category,
                        pos: card.pos,
                        gender: card.gender,
                        example: card.example,
                        tags: card.tags,
                        isStarred: card.isStarred ?? false,
                        learnState: card.learnState,
                        learnCorrectStreak: card.learnCorrectStreak,
                        learnCorrectTotal: card.learnCorrectTotal,
                        learnIncorrectTotal: card.learnIncorrectTotal,
                        learnLastAnsweredAt: card.learnLastAnsweredAt,
                        createdAt: now,
                        updatedAt: now,
                        lastReviewedAt: card.lastReviewedAt,
                        due: card.due,
                        stability: card.stability,
                        difficulty: card.difficulty,
                        elapsed_days: card.elapsed_days,
                        scheduled_days: card.scheduled_days,
                        learning_steps: card.learning_steps,
                        reps: card.reps,
                        lapses: card.lapses,
                        state: card.state,
                    }));

                    insertedCards = await tx.insert(cards).values(cardsToInsert).returning();
                }

                await tx.insert(deckClones).values({
                    id: createId(),
                    originalDeckId: deckId,
                    clonedDeckId,
                    userId,
                    createdAt: now,
                });

                await tx
                    .update(decks)
                    .set({
                        downloadCount: sql`${decks.downloadCount} + 1`,
                        updatedAt: now,
                    })
                    .where(eq(decks.id, deckId));

                await tx.insert(syncChanges).values({
                    userId,
                    entityType: 'deck',
                    entityId: insertedDeck.id,
                    operation: 'create',
                    payload: buildDeckPayload(insertedDeck),
                });

                if (insertedCards.length > 0) {
                    const syncCardChanges: Array<typeof syncChanges.$inferInsert> = insertedCards.map((card) => ({
                        userId,
                        entityType: 'card',
                        entityId: card.id,
                        operation: 'create',
                        payload: buildCardPayload(card),
                    }));
                    await tx.insert(syncChanges).values(syncCardChanges);
                }
            });

            const clonedDeck = await db.query.decks.findFirst({
                where: eq(decks.id, clonedDeckId),
                with: {
                    cards: true,
                },
            });

            if (!clonedDeck) {
                throw errorFactory.database('Failed to retrieve cloned deck');
            }

            return clonedDeck;
        })(),
        (error) =>
            error instanceof NotFoundError
                ? error
                : errorFactory.database('Failed to clone deck', { cause: error })
    );
}

export function incrementViewCountOperation(deckId: string): ResultAsync<void, DatabaseError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        (async () => {
            await db
                .update(decks)
                .set({
                    viewCount: sql`${decks.viewCount} + 1`,
                })
                .where(eq(decks.id, deckId));
        })(),
        (error) => errorFactory.database('Failed to increment view count', { cause: error })
    );
}
