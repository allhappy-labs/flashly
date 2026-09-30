/**
 * Category Repository - Manage deck categories
 */

import { eq, and, desc, sql, count } from 'drizzle-orm';
import type { ResultAsync } from 'neverthrow';
import { errAsync } from 'neverthrow';
import {
    NotFoundError,
    ValidationError,
    errorFactory,
    safeAsync,
    type DatabaseError,
} from '@flashly/shared';
import { db } from '../../db/db.ts';
import { cards, deckCategories, deckCategoryJoins, decks } from '../auth/auth-schema.ts';

// ============================================================================
// TYPES
// ============================================================================

export type Category = typeof deckCategories.$inferSelect;
export type CategoryWithChildren = Category & {
    children: CategoryWithChildren[];
};

export interface CategoryTree {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    icon: string | null;
    displayOrder: number;
    deckCount: number;
    children: CategoryTree[];
}

// ============================================================================
// CATEGORY REPOSITORY
// ============================================================================

export class CategoryRepository {
    private mapError(error: unknown): DatabaseError | NotFoundError | ValidationError {
        if (error instanceof NotFoundError || error instanceof ValidationError) {
            return error;
        }

        return errorFactory.database('Category repository operation failed', { cause: error });
    }

    /**
     * Get all categories as a flat list
     */
    getAllCategories(): ResultAsync<Category[], DatabaseError> {
        return safeAsync(
            async () => {
                const categories = await db
                    .select()
                    .from(deckCategories)
                    .orderBy(deckCategories.displayOrder, deckCategories.name);

                return categories;
            },
            (error) => errorFactory.database('Failed to get categories', { cause: error })
        );
    }

    /**
     * Get categories as a tree structure
     */
    getCategoryTree(): ResultAsync<CategoryTree[], DatabaseError> {
        return safeAsync(
            async () => {
                const categories = await db
                    .select()
                    .from(deckCategories)
                    .orderBy(deckCategories.displayOrder, deckCategories.name);

                // Build tree structure
                const categoryMap = new Map<string, CategoryTree>();
                const rootCategories: CategoryTree[] = [];

                // First pass: create map entries
                categories.forEach((category) => {
                    categoryMap.set(category.id, {
                        ...category,
                        children: [],
                    });
                });

                // Second pass: build tree
                categories.forEach((category) => {
                    const node = categoryMap.get(category.id);
                    if (!node) {
                        return;
                    }

                    if (category.parentId) {
                        const parent = categoryMap.get(category.parentId);
                        if (parent) {
                            parent.children.push(node);
                        } else {
                            // Parent doesn't exist, treat as root
                            rootCategories.push(node);
                        }
                    } else {
                        rootCategories.push(node);
                    }
                });

                return rootCategories;
            },
            (error) => errorFactory.database('Failed to get category tree', { cause: error })
        );
    }

    /**
     * Get a single category by ID
     */
    getCategoryById(categoryId: string): ResultAsync<Category, DatabaseError | NotFoundError | ValidationError> {
        if (!categoryId) {
            return errAsync(
                errorFactory.validation('Category ID is required', { field: 'categoryId' })
            );
        }

        return safeAsync(
            async () => {
                const [category] = await db
                    .select()
                    .from(deckCategories)
                    .where(eq(deckCategories.id, categoryId))
                    .limit(1);

                if (!category) {
                    throw errorFactory.notFound('Category not found');
                }

                return category;
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Get category by slug
     */
    getCategoryBySlug(slug: string): ResultAsync<Category, DatabaseError | NotFoundError | ValidationError> {
        if (!slug) {
            return errAsync(
                errorFactory.validation('Slug is required', { field: 'slug' })
            );
        }

        return safeAsync(
            async () => {
                const [category] = await db
                    .select()
                    .from(deckCategories)
                    .where(eq(deckCategories.slug, slug))
                    .limit(1);

                if (!category) {
                    throw errorFactory.notFound('Category not found');
                }

                return category;
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Get decks in a category (including subcategories)
     */
    getCategoryDecks(
        categorySlug: string,
        options: { limit?: number; offset?: number; includeSubcategories?: boolean } = {}
    ): ResultAsync<{
        decks: Array<{
            id: string;
            name: string;
            description: string | null;
            cardCount: number;
            downloadCount: number;
            viewCount: number;
        }>;
        total: number;
    }, DatabaseError | NotFoundError | ValidationError> {
        if (!categorySlug) {
            return errAsync(
                errorFactory.validation('Category slug is required', { field: 'categorySlug' })
            );
        }

        const limit = options.limit || 20;
        const offset = options.offset || 0;
        const includeSubcategories = options.includeSubcategories !== false;

        return safeAsync(
            async () => {
                // Get category
                const [category] = await db
                    .select()
                    .from(deckCategories)
                    .where(eq(deckCategories.slug, categorySlug))
                    .limit(1);

                if (!category) {
                    throw errorFactory.notFound('Category not found');
                }

                // Get all category IDs to search (including subcategories)
                let categoryIds = [category.id];

                if (includeSubcategories) {
                    const subCategories = await db
                        .select({ id: deckCategories.id })
                        .from(deckCategories)
                        .where(eq(deckCategories.parentId, category.id));

                    categoryIds.push(...subCategories.map((c) => c.id));
                }

                // Count total decks
                const [{ total }] = await db
                    .select({ total: count(sql<number>`DISTINCT ${decks.id}`) })
                    .from(deckCategoryJoins)
                    .where(
                        sql`${deckCategoryJoins.categoryId} = ANY(${categoryIds})`
                    );

                // Get decks with pagination
                const deckRows = await db
                    .select({
                        id: decks.id,
                        name: decks.name,
                        description: decks.description,
                        downloadCount: decks.downloadCount,
                        viewCount: decks.viewCount,
                        cardCount: count(cards.id),
                    })
                    .from(deckCategoryJoins)
                    .innerJoin(decks, eq(deckCategoryJoins.deckId, decks.id))
                    .leftJoin(cards, eq(cards.deckId, decks.id))
                    .where(
                        and(
                            sql`${deckCategoryJoins.categoryId} = ANY(${categoryIds})`,
                            eq(decks.visibility, 'public')
                        )
                    )
                    .groupBy(decks.id)
                    .orderBy(desc(decks.downloadCount), desc(decks.createdAt))
                    .limit(limit)
                    .offset(offset);

                const decksWithCounts = deckRows.map((row) => ({
                    ...row,
                    cardCount: Number(row.cardCount || 0),
                }));

                return {
                    decks: decksWithCounts,
                    total: Number(total || 0),
                };
            },
            (error) => this.mapError(error)
        );
    }
}

// Export singleton instance
export const categoryRepository = new CategoryRepository();
