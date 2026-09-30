/**
 * Template Repository - Manage deck templates
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import type { ResultAsync} from 'neverthrow';
import { errAsync } from 'neverthrow';
import type {
    DatabaseError,
    ValidationError,
    NotFoundError,
    ForbiddenError} from '@flashly/shared';
import {
    safeAsync,
    errorFactory,
    createId,
} from '@flashly/shared';
import { db } from '../../db/db.ts';
import { decks, cards } from '../auth/auth-schema.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface Template {
    id: string;
    name: string;
    description: string | null;
    materialType: string | null;
    deckType: string | null;
    locale: string | null;
    cardCount: number;
    downloadCount: number;
    previewCards: Array<{
        front: string;
        back: string;
        imageUrl: string | null;
        category: string | null;
    }>;
}

export interface CreateFromTemplateInput {
    templateId: string;
    name: string;
    description?: string;
}

// ============================================================================
// TEMPLATE REPOSITORY
// ============================================================================

export class TemplateRepository {
    /**
     * Get all available templates
     */
    getTemplates(): ResultAsync<Template[], DatabaseError> {
        return safeAsync(
            async () => {
                const templateDecks = await db
                    .select({
                        id: decks.id,
                        name: decks.name,
                        description: decks.description,
                        materialType: decks.materialType,
                        deckType: decks.deckType,
                        locale: decks.locale,
                        downloadCount: decks.downloadCount,
                    })
                    .from(decks)
                    .where(eq(decks.isTemplate, true))
                    .orderBy(desc(decks.downloadCount), desc(decks.createdAt));

                // Get preview cards (first 3 cards) for each template
                const templates = await Promise.all(
                    templateDecks.map(async (template) => {
                        const previewCardsResult = await db
                            .select({
                                front: cards.front,
                                back: cards.back,
                                imageUrl: cards.imageUrl,
                                category: cards.category,
                            })
                            .from(cards)
                            .where(eq(cards.deckId, template.id))
                            .limit(3);

                        const [cardCount] = await db
                            .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
                            .from(cards)
                            .where(eq(cards.deckId, template.id));

                        return {
                            ...template,
                            cardCount: cardCount?.count || 0,
                            previewCards: previewCardsResult,
                        };
                    })
                );

                return templates as Template[];
            },
            (error) => errorFactory.database('Failed to get templates', { cause: error })
        );
    }

    /**
     * Create a deck from a template
     */
    createFromTemplate(
        userId: string,
        input: CreateFromTemplateInput
    ): ResultAsync<{ id: string; name: string }, DatabaseError | ValidationError | NotFoundError> {
        if (!userId) {
            return errAsync(
                errorFactory.validation('User ID is required', { field: 'userId' })
            );
        }

        if (!input.templateId) {
            return errAsync(
                errorFactory.validation('Template ID is required', { field: 'templateId' })
            );
        }

        if (!input.name || !input.name.trim()) {
            return errAsync(
                errorFactory.validation('Deck name is required', { field: 'name' })
            );
        }

        return safeAsync(
            async () => {
                // Get template
                const [templateDeck] = await db
                    .select()
                    .from(decks)
                    .where(eq(decks.id, input.templateId))
                    .limit(1);

                if (!templateDeck) {
                    throw errorFactory.notFound('Template not found');
                }

                if (!templateDeck.isTemplate) {
                    throw errorFactory.validation('Deck is not a template', {
                        field: 'templateId',
                    });
                }

                // Get template cards
                const templateCards = await db
                    .select()
                    .from(cards)
                    .where(eq(cards.deckId, input.templateId));

                const now = new Date();
                const newDeckId = createId();

                // Create deck from template
                await db.transaction(async (tx) => {
                    // Insert deck
                    await tx.insert(decks).values({
                        id: newDeckId,
                        userId,
                        name: input.name.trim(),
                        description: input.description?.trim() ?? null,
                        accentKey: templateDeck.accentKey,
                        materialType: templateDeck.materialType,
                        deckType: templateDeck.deckType,
                        locale: templateDeck.locale,
                        visibility: 'private',
                        isFeatured: false,
                        downloadCount: 0,
                        viewCount: 0,
                        lastSyncedAt: null,
                        createdAt: now,
                        updatedAt: now,
                        lastStudiedAt: null,
                        isTemplate: false,
                        templateId: input.templateId,
                        templateData: {
                            createdAt: templateDeck.createdAt,
                            deckName: templateDeck.name,
                        },
                    });

                    // Clone cards
                    if (templateCards.length > 0) {
                        const cardsToInsert = templateCards.map((card) => ({
                            id: createId(),
                            deckId: newDeckId,
                            front: card.front,
                            back: card.back,
                            imageUrl: card.imageUrl,
                            audioUrl: card.audioUrl,
                            category: card.category,
                            pos: card.pos,
                            gender: card.gender,
                            example: card.example,
                            tags: card.tags,
                            isStarred: false,
                            learnState: null,
                            learnCorrectStreak: null,
                            learnCorrectTotal: null,
                            learnIncorrectTotal: null,
                            learnLastAnsweredAt: null,
                            createdAt: now,
                            updatedAt: now,
                            lastReviewedAt: null,
                            due: null,
                            stability: null,
                            difficulty: null,
                            elapsed_days: null,
                            scheduled_days: null,
                            learning_steps: null,
                            reps: null,
                            lapses: null,
                            state: null,
                        }));

                        await tx.insert(cards).values(cardsToInsert);
                    }
                });

                // Increment template usage count (using downloadCount for this)
                await db
                    .update(decks)
                    .set({
                        downloadCount: sql`${decks.downloadCount} + 1`,
                    })
                    .where(eq(decks.id, input.templateId));

                return {
                    id: newDeckId,
                    name: input.name.trim(),
                };
            },
            (error) => errorFactory.database('Failed to create deck from template', { cause: error })
        );
    }

    /**
     * Create a template from an existing deck (admin only)
     */
    createTemplate(
        deckId: string,
        userId: string
    ): ResultAsync<void, DatabaseError | NotFoundError | ForbiddenError> {
        if (!deckId || !userId) {
            return errAsync(
                errorFactory.validation('Deck ID and User ID are required', {
                    field: 'deckId,userId',
                })
            );
        }

        return safeAsync(
            async () => {
            // Verify ownership
            const [deck] = await db
                .select()
                .from(decks)
                .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
                .limit(1);

            if (!deck) {
                throw errorFactory.notFound('Deck not found or access denied');
            }

            // Mark as template
            await db
                .update(decks)
                .set({ isTemplate: true })
                .where(eq(decks.id, deckId));
        },
            (error) => errorFactory.database('Failed to create template', { cause: error })
        );
    }
}

// Export singleton instance
export const templateRepository = new TemplateRepository();
