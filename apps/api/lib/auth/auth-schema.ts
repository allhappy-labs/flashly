import { relations } from 'drizzle-orm';
import { boolean, integer, json, pgTable, real, text, timestamp, serial, index } from 'drizzle-orm/pg-core';
import type { MarketplaceMetadata, QuizEnrichment } from '@flashly/shared';

export const user = pgTable('user', {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    id: text('id').primaryKey(),
    image: text('image'),
    name: text('name').notNull(),
    updatedAt: timestamp('updated_at')
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
    username: text('username').default(''),
    bio: text('bio'),
    website: text('website'),
    twitterHandle: text('twitter_handle'),
    followerCount: integer('follower_count').notNull().default(0),
    role: text('role').notNull().default('user'),
});

export const session = pgTable('session', {
    createdAt: timestamp('created_at').defaultNow().notNull(), expiresAt: timestamp('expires_at').notNull(), id: text('id').primaryKey(), ipAddress: text('ip_address'), token: text('token').notNull().unique(), updatedAt: timestamp('updated_at')
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(), userAgent: text('user_agent'), userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
    accessToken: text('access_token'), accessTokenExpiresAt: timestamp('access_token_expires_at'), accountId: text('account_id').notNull(), createdAt: timestamp('created_at').defaultNow().notNull(), id: text('id').primaryKey(), idToken: text('id_token'), password: text('password'), providerId: text('provider_id').notNull(), refreshToken: text('refresh_token'), refreshTokenExpiresAt: timestamp('refresh_token_expires_at'), scope: text('scope'), updatedAt: timestamp('updated_at')
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(), userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
});

export const verification = pgTable('verification', {
    createdAt: timestamp('created_at').defaultNow().notNull(), expiresAt: timestamp('expires_at').notNull(), id: text('id').primaryKey(), identifier: text('identifier').notNull(), updatedAt: timestamp('updated_at')
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(), value: text('value').notNull(),
});

// Decks table with user ownership
export const decks = pgTable('decks', {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    accentKey: text('accent_key'),
    materialType: text('material_type'),
    deckType: text('deck_type'),
    locale: text('locale'),
    visibility: text('visibility', { enum: ['private', 'public'] }).notNull().default('private'),
    isFeatured: boolean('is_featured').notNull().default(false),
    downloadCount: integer('download_count').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastStudiedAt: timestamp('last_studied_at'),
    isTemplate: boolean('is_template').notNull().default(false),
    templateId: text('template_id'),
    templateData: json('template_data'),
    marketplaceMetadata: json('marketplace_metadata').$type<MarketplaceMetadata | null>(),
});

// Cards table
export const cards = pgTable('cards', {
    id: text('id').primaryKey().notNull(),
    deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
    front: text('front').notNull(),
    back: text('back').notNull(),
    imageUrl: text('image_url'),
    audioUrl: text('audio_url'),
    category: text('category'),
    pos: text('pos'),
    gender: text('gender'),
    example: text('example'),
    tags: text('tags'), // JSON string array
    quiz: json('quiz').$type<QuizEnrichment | null>(),
    isStarred: boolean('is_starred').notNull().default(false),
    learnState: text('learn_state', { enum: ['not_studied', 'learning', 'mastered'] }),
    learnCorrectStreak: integer('learn_correct_streak'),
    learnCorrectTotal: integer('learn_correct_total'),
    learnIncorrectTotal: integer('learn_incorrect_total'),
    learnLastAnsweredAt: timestamp('learn_last_answered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastReviewedAt: timestamp('last_reviewed_at'),
    due: timestamp('due'),
    stability: real('stability'),
    difficulty: real('difficulty'),
    elapsed_days: integer('elapsed_days'),
    scheduled_days: integer('scheduled_days'),
    learning_steps: integer('learning_steps'),
    reps: integer('reps'),
    lapses: integer('lapses'),
    state: text('state', { enum: ['new', 'learning', 'review', 'relearning'] }),
});

export const decksRelations = relations(decks, ({ many }) => ({
    cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one }) => ({
    deck: one(decks, { fields: [cards.deckId], references: [decks.id] }),
}));

// Sync state tracking
export const deckSyncState = pgTable('deck_sync_state', {
    userId: text('user_id').primaryKey().notNull().references(() => user.id, { onDelete: 'cascade' }),
    lastSyncAt: timestamp('last_sync_at').notNull(),
    syncCursor: text('sync_cursor'),
    pendingChanges: integer('pending_changes').notNull().default(0),
});

// Sync ledger for incremental synchronization
export const syncChanges = pgTable('sync_changes', {
    seq: serial('seq').primaryKey().notNull(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    entityType: text('entity_type', { enum: ['deck', 'card'] }).notNull(),
    entityId: text('entity_id').notNull(),
    operation: text('operation', { enum: ['create', 'update', 'delete'] }).notNull(),
    changedAt: timestamp('changed_at').defaultNow().notNull(),
    payload: json('payload'),
}, (table) => ({
    userSeqIdx: index('sync_changes_user_seq_idx').on(table.userId, table.seq),
}));

// Study review events for analytics
export const studyReviewEvents = pgTable('study_review_events', {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
    cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    reviewedAt: timestamp('reviewed_at').notNull(),
    responseMs: integer('response_ms'),
    deviceId: text('device_id'),
    clientUpdatedAt: timestamp('client_updated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Study session events for analytics
export const studySessionEvents = pgTable('study_session_events', {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    startedAt: timestamp('started_at').notNull(),
    endedAt: timestamp('ended_at'),
    durationMs: integer('duration_ms'),
    deviceId: text('device_id'),
    clientUpdatedAt: timestamp('client_updated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Deck clones/remixes tracking
export const deckClones = pgTable('deck_clones', {
    id: text('id').primaryKey().notNull(),
    originalDeckId: text('original_deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
    clonedDeckId: text('cloned_deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    userOriginalDeckIdx: index('deck_clones_user_original_deck_idx').on(table.userId, table.originalDeckId),
}));

// Deck ratings
export const deckRatings = pgTable('deck_ratings', {
    id: text('id').primaryKey().notNull(),
    deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Deck reviews
export const deckReviews = pgTable('deck_reviews', {
    id: text('id').primaryKey().notNull(),
    deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    title: text('title'),
    content: text('content').notNull(),
    helpfulCount: integer('helpful_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Deck categories for organization
export const deckCategories = pgTable('deck_categories', {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    parentId: text('parent_id'),
    icon: text('icon'),
    displayOrder: integer('display_order').notNull().default(0),
    deckCount: integer('deck_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Many-to-many join table for decks and categories
export const deckCategoryJoins = pgTable('deck_category_joins', {
    deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').notNull().references(() => deckCategories.id, { onDelete: 'cascade' }),
});

// Track deck views for recommendations
export const deckViews = pgTable('deck_views', {
    id: text('id').primaryKey().notNull(),
    deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
    userId: text('user_id'),
    sessionId: text('session_id'),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
});

// Deck nominations for community curation
export const deckNominations = pgTable('deck_nominations', {
    id: text('id').primaryKey().notNull(),
    deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// User follows (for social features)
export const userFollows = pgTable('user_follows', {
    followerId: text('follower_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    followingId: text('following_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
