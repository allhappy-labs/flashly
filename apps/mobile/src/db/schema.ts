import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const decks = sqliteTable("decks", {
  id: text("id").primaryKey().notNull(),
  userId: text("userId"), // Nullable for local-first support, set after auth
  name: text("name").notNull(),
  description: text("description"),
  accentKey: text("accentKey"),
  materialType: text("materialType"),
  deckType: text("deckType"),
  locale: text("locale"),
  visibility: text("visibility", { mode: 'text' }).$type<'private' | 'public'>().default('private'),
  isFeatured: integer("isFeatured", { mode: "boolean" }).notNull().default(false),
  downloadCount: integer("downloadCount", { mode: "number" }).notNull().default(0),
  viewCount: integer("viewCount", { mode: "number" }).notNull().default(0),
  syncStatus: text("syncStatus", { mode: 'text' }).$type<'synced' | 'pending' | 'conflict' | 'local-only'>().default('local-only'),
  serverDeckId: text("serverDeckId"), // Server-side deck ID after sync
  lastSyncedAt: integer("lastSyncedAt", { mode: "number" }),
  version: integer("version", { mode: "number" }).notNull().default(1), // For conflict resolution
  createdAt: integer("createdAt", { mode: "number" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "number" }).notNull(),
  lastStudiedAt: integer("lastStudiedAt", { mode: "number" }),
});

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey().notNull(),
  deckId: text("deckId").notNull(),
  front: text("front").notNull(),
  back: text("back").notNull(),
  imageUrl: text("imageUrl"),
  audioUrl: text("audioUrl"),
  createdAt: integer("createdAt", { mode: "number" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "number" }).notNull(),
  lastReviewedAt: integer("lastReviewedAt", { mode: "number" }),
  isKnown: integer("isKnown", { mode: "number" }).notNull().default(0),
  isStarred: integer("isStarred", { mode: "number" }).notNull().default(0),
  learnState: text("learnState"),
  learnCorrectStreak: integer("learnCorrectStreak", { mode: "number" }),
  learnCorrectTotal: integer("learnCorrectTotal", { mode: "number" }),
  learnIncorrectTotal: integer("learnIncorrectTotal", { mode: "number" }),
  learnLastAnsweredAt: integer("learnLastAnsweredAt", { mode: "number" }),
  due: integer("due", { mode: "number" }),
  stability: real("stability"),
  difficulty: real("difficulty"),
  elapsed_days: integer("elapsed_days", { mode: "number" }),
  scheduled_days: integer("scheduled_days", { mode: "number" }),
  learning_steps: integer("learning_steps", { mode: "number" }),
  reps: integer("reps", { mode: "number" }),
  lapses: integer("lapses", { mode: "number" }),
  state: text("state"),
  category: text("category"),
  pos: text("pos"),
  gender: text("gender"),
  example: text("example"),
  tags: text("tags"),
  quiz: text("quiz"),
});

export const studySessions = sqliteTable("study_sessions", {
  id: text("id").primaryKey().notNull(),
  deckId: text("deckId").notNull(),
  startedAt: integer("startedAt", { mode: "number" }).notNull(),
  endedAt: integer("endedAt", { mode: "number" }),
  durationMs: integer("durationMs", { mode: "number" }),
});

export const studyHistory = sqliteTable("study_history", {
  id: text("id").primaryKey().notNull(),
  cardId: text("cardId").notNull(),
  deckId: text("deckId").notNull(),
  outcome: integer("outcome", { mode: "number" }),
  rating: integer("rating", { mode: "number" }).notNull(),
  state: text("state").notNull(),
  due: integer("due", { mode: "number" }).notNull(),
  stability: real("stability").notNull(),
  difficulty: real("difficulty").notNull(),
  elapsed_days: integer("elapsed_days", { mode: "number" }).notNull(),
  scheduled_days: integer("scheduled_days", { mode: "number" }).notNull(),
  createdAt: integer("createdAt", { mode: "number" }).notNull(),
  sessionId: text("sessionId"),
});

// Sync state tracking
export const syncState = sqliteTable("sync_state", {
  id: text("id").primaryKey(),
  lastSyncAt: integer("lastSyncAt", { mode: "number" }).notNull(),
  pendingUploads: integer("pendingUploads", { mode: "number" }).notNull().default(0),
  pendingDownloads: integer("pendingDownloads", { mode: "number" }).notNull().default(0),
  syncCursor: text("syncCursor"), // Server-provided cursor for incremental sync
});

// Sync queue for offline operations
export const syncQueue = sqliteTable("sync_queue", {
  id: text("id").primaryKey(),
  userId: text("userId"),
  entityType: text("entityType", { mode: 'text' }).$type<'deck' | 'card'>().notNull(),
  entityId: text("entityId").notNull(),
  operation: text("operation", { mode: 'text' }).$type<'create' | 'update' | 'delete'>().notNull(),
  payload: text("payload").notNull(), // JSON string of entity data
  createdAt: integer("createdAt", { mode: "number" }).notNull(),
  retries: integer("retries", { mode: "number" }).notNull().default(0),
  lastAttemptAt: integer("lastAttemptAt", { mode: "number" }),
  error: text("error"), // Last error message
});

// Study events outbox for offline analytics sync
export const studyEventOutbox = sqliteTable("study_event_outbox", {
  id: text("id").primaryKey(),
  userId: text("userId"),
  eventType: text("eventType", { mode: 'text' }).$type<'review' | 'session'>().notNull(),
  payload: text("payload").notNull(),
  createdAt: integer("createdAt", { mode: "number" }).notNull(),
  retries: integer("retries", { mode: "number" }).notNull().default(0),
  lastAttemptAt: integer("lastAttemptAt", { mode: "number" }),
  error: text("error"),
});

// Cached analytics from server
export const analyticsCache = sqliteTable("analytics_cache", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  deckId: text("deckId").notNull(),
  windowDays: integer("windowDays", { mode: "number" }).notNull(),
  payload: text("payload").notNull(),
  updatedAt: integer("updatedAt", { mode: "number" }).notNull(),
});

export const schema = {
  decks,
  cards,
  studySessions,
  studyHistory,
  syncState,
  syncQueue,
  studyEventOutbox,
  analyticsCache,
};
