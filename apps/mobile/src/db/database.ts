import * as SQLite from "expo-sqlite";
import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { schema } from "./schema";
import { buildFsrsDefaults } from "../services/fsrsScheduler";

let rawDb: SQLite.SQLiteDatabase | null = null;
let db: ExpoSQLiteDatabase<typeof schema> | null = null;

export async function getRawDb() {
  if (!rawDb) {
    rawDb = await SQLite.openDatabaseAsync("flashly.db");
  }
  return rawDb;
}

export async function getDb() {
  if (!db) {
    const sqliteDb = await getRawDb();
    db = drizzle(sqliteDb, { schema });
  }
  return db;
}

async function ensureColumn(database: SQLite.SQLiteDatabase, table: string, column: string, alterSql: string) {
  const info = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  const hasColumn = info.some((col) => col.name === column);
  if (!hasColumn) {
    await database.execAsync(alterSql);
  }
}

export async function initializeDatabase() {
  const database = await getRawDb();
  await database.execAsync("PRAGMA journal_mode = WAL;");
  await database.execAsync("PRAGMA foreign_keys = ON;");
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      accentKey TEXT,
      materialType TEXT,
      deckType TEXT,
      locale TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      lastStudiedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY NOT NULL,
      deckId TEXT NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      imageUrl TEXT,
      audioUrl TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      lastReviewedAt INTEGER,
      isKnown INTEGER NOT NULL DEFAULT 0,
      isStarred INTEGER NOT NULL DEFAULT 0,
      learnState TEXT,
      learnCorrectStreak INTEGER,
      learnCorrectTotal INTEGER,
      learnIncorrectTotal INTEGER,
      learnLastAnsweredAt INTEGER,
      due INTEGER,
      stability REAL,
      difficulty REAL,
      elapsed_days INTEGER,
      scheduled_days INTEGER,
      learning_steps INTEGER,
      reps INTEGER,
      lapses INTEGER,
      state TEXT,
      category TEXT,
      pos TEXT,
      gender TEXT,
      example TEXT,
      tags TEXT,
      quiz TEXT,
      FOREIGN KEY(deckId) REFERENCES decks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cards_deckId ON cards(deckId);
    CREATE INDEX IF NOT EXISTS idx_cards_deck_due_created ON cards(deckId, due, createdAt);

    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      deckId TEXT NOT NULL,
      startedAt INTEGER NOT NULL,
      endedAt INTEGER,
      durationMs INTEGER,
      FOREIGN KEY(deckId) REFERENCES decks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS study_history (
      id TEXT PRIMARY KEY NOT NULL,
      cardId TEXT NOT NULL,
      deckId TEXT NOT NULL,
      outcome INTEGER,
      rating INTEGER NOT NULL,
      state TEXT NOT NULL,
      due INTEGER NOT NULL,
      stability REAL NOT NULL,
      difficulty REAL NOT NULL,
      elapsed_days INTEGER NOT NULL,
      scheduled_days INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      sessionId TEXT,
      FOREIGN KEY(cardId) REFERENCES cards(id) ON DELETE CASCADE,
      FOREIGN KEY(deckId) REFERENCES decks(id) ON DELETE CASCADE,
      FOREIGN KEY(sessionId) REFERENCES study_sessions(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_history_card ON study_history(cardId);
    CREATE INDEX IF NOT EXISTS idx_history_deck ON study_history(deckId);
    CREATE INDEX IF NOT EXISTS idx_history_session ON study_history(sessionId);
    CREATE INDEX IF NOT EXISTS idx_sessions_deck ON study_sessions(deckId);
    CREATE INDEX IF NOT EXISTS idx_history_deck_created ON study_history(deckId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_sessions_deck_started ON study_sessions(deckId, startedAt);

    CREATE TABLE IF NOT EXISTS sync_state (
      id TEXT PRIMARY KEY NOT NULL,
      lastSyncAt INTEGER NOT NULL,
      pendingUploads INTEGER NOT NULL DEFAULT 0,
      pendingDownloads INTEGER NOT NULL DEFAULT 0,
      syncCursor TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      retries INTEGER NOT NULL DEFAULT 0,
      lastAttemptAt INTEGER,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS study_event_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT,
      eventType TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      retries INTEGER NOT NULL DEFAULT 0,
      lastAttemptAt INTEGER,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS analytics_cache (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      deckId TEXT NOT NULL,
      windowDays INTEGER NOT NULL,
      payload TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);

  await ensureColumn(database, "cards", "isKnown", "ALTER TABLE cards ADD COLUMN isKnown INTEGER NOT NULL DEFAULT 0;");
  await ensureColumn(database, "cards", "isStarred", "ALTER TABLE cards ADD COLUMN isStarred INTEGER NOT NULL DEFAULT 0;");
  await ensureColumn(database, "cards", "learnState", "ALTER TABLE cards ADD COLUMN learnState TEXT;");
  await ensureColumn(
    database,
    "cards",
    "learnCorrectStreak",
    "ALTER TABLE cards ADD COLUMN learnCorrectStreak INTEGER;",
  );
  await ensureColumn(
    database,
    "cards",
    "learnCorrectTotal",
    "ALTER TABLE cards ADD COLUMN learnCorrectTotal INTEGER;",
  );
  await ensureColumn(
    database,
    "cards",
    "learnIncorrectTotal",
    "ALTER TABLE cards ADD COLUMN learnIncorrectTotal INTEGER;",
  );
  await ensureColumn(
    database,
    "cards",
    "learnLastAnsweredAt",
    "ALTER TABLE cards ADD COLUMN learnLastAnsweredAt INTEGER;",
  );
  await ensureColumn(database, "cards", "due", "ALTER TABLE cards ADD COLUMN due INTEGER;");
  await ensureColumn(database, "cards", "stability", "ALTER TABLE cards ADD COLUMN stability REAL;");
  await ensureColumn(database, "cards", "difficulty", "ALTER TABLE cards ADD COLUMN difficulty REAL;");
  await ensureColumn(database, "cards", "elapsed_days", "ALTER TABLE cards ADD COLUMN elapsed_days INTEGER;");
  await ensureColumn(database, "cards", "scheduled_days", "ALTER TABLE cards ADD COLUMN scheduled_days INTEGER;");
  await ensureColumn(database, "cards", "learning_steps", "ALTER TABLE cards ADD COLUMN learning_steps INTEGER;");
  await ensureColumn(database, "cards", "reps", "ALTER TABLE cards ADD COLUMN reps INTEGER;");
  await ensureColumn(database, "cards", "lapses", "ALTER TABLE cards ADD COLUMN lapses INTEGER;");
  await ensureColumn(database, "cards", "state", "ALTER TABLE cards ADD COLUMN state TEXT;");
  await ensureColumn(database, "cards", "category", "ALTER TABLE cards ADD COLUMN category TEXT;");
  await ensureColumn(database, "cards", "pos", "ALTER TABLE cards ADD COLUMN pos TEXT;");
  await ensureColumn(database, "cards", "gender", "ALTER TABLE cards ADD COLUMN gender TEXT;");
  await ensureColumn(database, "cards", "example", "ALTER TABLE cards ADD COLUMN example TEXT;");
  await ensureColumn(database, "cards", "tags", "ALTER TABLE cards ADD COLUMN tags TEXT;");
  await ensureColumn(database, "cards", "quiz", "ALTER TABLE cards ADD COLUMN quiz TEXT;");
  await ensureColumn(database, "cards", "imageUrl", "ALTER TABLE cards ADD COLUMN imageUrl TEXT;");
  await ensureColumn(database, "cards", "audioUrl", "ALTER TABLE cards ADD COLUMN audioUrl TEXT;");
  await ensureColumn(database, "decks", "accentKey", "ALTER TABLE decks ADD COLUMN accentKey TEXT;");
  await ensureColumn(database, "decks", "materialType", "ALTER TABLE decks ADD COLUMN materialType TEXT;");
  await ensureColumn(database, "decks", "deckType", "ALTER TABLE decks ADD COLUMN deckType TEXT;");
  await ensureColumn(database, "decks", "locale", "ALTER TABLE decks ADD COLUMN locale TEXT;");
  await ensureColumn(database, "decks", "userId", "ALTER TABLE decks ADD COLUMN userId TEXT;");
  await ensureColumn(
    database,
    "decks",
    "visibility",
    "ALTER TABLE decks ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';"
  );
  await ensureColumn(
    database,
    "decks",
    "isFeatured",
    "ALTER TABLE decks ADD COLUMN isFeatured INTEGER NOT NULL DEFAULT 0;"
  );
  await ensureColumn(
    database,
    "decks",
    "downloadCount",
    "ALTER TABLE decks ADD COLUMN downloadCount INTEGER NOT NULL DEFAULT 0;"
  );
  await ensureColumn(
    database,
    "decks",
    "viewCount",
    "ALTER TABLE decks ADD COLUMN viewCount INTEGER NOT NULL DEFAULT 0;"
  );
  await ensureColumn(database, "decks", "syncStatus", "ALTER TABLE decks ADD COLUMN syncStatus TEXT;");
  await ensureColumn(database, "decks", "serverDeckId", "ALTER TABLE decks ADD COLUMN serverDeckId TEXT;");
  await ensureColumn(database, "decks", "lastSyncedAt", "ALTER TABLE decks ADD COLUMN lastSyncedAt INTEGER;");
  await ensureColumn(
    database,
    "decks",
    "version",
    "ALTER TABLE decks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;"
  );

  await ensureColumn(database, "study_sessions", "endedAt", "ALTER TABLE study_sessions ADD COLUMN endedAt INTEGER;");
  await ensureColumn(
    database,
    "study_sessions",
    "durationMs",
    "ALTER TABLE study_sessions ADD COLUMN durationMs INTEGER;",
  );
  await ensureColumn(database, "sync_queue", "userId", "ALTER TABLE sync_queue ADD COLUMN userId TEXT;");
  await ensureColumn(database, "study_event_outbox", "userId", "ALTER TABLE study_event_outbox ADD COLUMN userId TEXT;");

  await ensureColumn(
    database,
    "study_history",
    "rating",
    "ALTER TABLE study_history ADD COLUMN rating INTEGER NOT NULL DEFAULT 3;",
  );
  await ensureColumn(
    database,
    "study_history",
    "state",
    "ALTER TABLE study_history ADD COLUMN state TEXT NOT NULL DEFAULT 'review';",
  );
  await ensureColumn(
    database,
    "study_history",
    "due",
    "ALTER TABLE study_history ADD COLUMN due INTEGER NOT NULL DEFAULT 0;",
  );
  await ensureColumn(
    database,
    "study_history",
    "stability",
    "ALTER TABLE study_history ADD COLUMN stability REAL NOT NULL DEFAULT 0;",
  );
  await ensureColumn(
    database,
    "study_history",
    "difficulty",
    "ALTER TABLE study_history ADD COLUMN difficulty REAL NOT NULL DEFAULT 0;",
  );
  await ensureColumn(
    database,
    "study_history",
    "elapsed_days",
    "ALTER TABLE study_history ADD COLUMN elapsed_days INTEGER NOT NULL DEFAULT 0;",
  );
  await ensureColumn(
    database,
    "study_history",
    "scheduled_days",
    "ALTER TABLE study_history ADD COLUMN scheduled_days INTEGER NOT NULL DEFAULT 0;",
  );

  await backfillFsrsDefaults(database);
}

export async function clearLocalDatabase(): Promise<void> {
  const database = await getRawDb();

  try {
    await database.execAsync("BEGIN IMMEDIATE;");
    await database.execAsync(`
      DELETE FROM study_event_outbox;
      DELETE FROM sync_queue;
      DELETE FROM analytics_cache;
      DELETE FROM sync_state;
      DELETE FROM study_history;
      DELETE FROM study_sessions;
      DELETE FROM cards;
      DELETE FROM decks;
    `);
    await database.execAsync("COMMIT;");
  } catch (error) {
    await database.execAsync("ROLLBACK;");
    throw error;
  }
}

async function backfillFsrsDefaults(database: SQLite.SQLiteDatabase) {
  const defaults = buildFsrsDefaults(Date.now());
  await database.runAsync(
    `
    UPDATE cards SET
      due = COALESCE(due, ?),
      stability = COALESCE(stability, ?),
      difficulty = COALESCE(difficulty, ?),
      elapsed_days = COALESCE(elapsed_days, ?),
      scheduled_days = COALESCE(scheduled_days, ?),
      learning_steps = COALESCE(learning_steps, ?),
      reps = COALESCE(reps, ?),
      lapses = COALESCE(lapses, ?),
      state = COALESCE(state, ?),
      lastReviewedAt = COALESCE(lastReviewedAt, ?)
    WHERE due IS NULL
      OR stability IS NULL
      OR difficulty IS NULL
      OR elapsed_days IS NULL
      OR scheduled_days IS NULL
      OR learning_steps IS NULL
      OR reps IS NULL
      OR lapses IS NULL
      OR state IS NULL;
  `,
    [
      defaults.due,
      defaults.stability,
      defaults.difficulty,
      defaults.elapsed_days,
      defaults.scheduled_days,
      defaults.learning_steps,
      defaults.reps,
      defaults.lapses,
      defaults.state,
      defaults.lastReviewedAt ?? null,
    ],
  );
}
