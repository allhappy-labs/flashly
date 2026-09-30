import type { QuizEnrichment } from '@flashly/shared';

export type DeckVisibility = 'private' | 'public';

export type Deck = {
  id: string;
  name: string;
  description?: string;
  accentKey?: string | null;
  materialType?: string | null;
  deckType?: string | null;
  locale?: string | null;
  visibility?: DeckVisibility;
  createdAt: number;
  updatedAt: number;
  lastStudiedAt?: number | null;
};

export type DeckWithStats = Deck & {
  cardCount: number;
  dueCount: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  relearningCount: number;
  retention: number;
};

export type FsrsState = "new" | "learning" | "review" | "relearning";
export type LearnState = "not_studied" | "learning" | "mastered";

export type Card = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  category?: string | null;
  pos?: string | null;
  gender?: string | null;
  example?: string | null;
  tags?: string[];
  isStarred?: boolean;
  learnState?: LearnState;
  learnCorrectStreak?: number;
  learnCorrectTotal?: number;
  learnIncorrectTotal?: number;
  learnLastAnsweredAt?: number | null;
  createdAt: number;
  updatedAt: number;
  lastReviewedAt?: number | null;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: FsrsState;
  quiz?: QuizEnrichment | null;
};

export type ParsedCard = {
  front: string;
  back: string;
  imageUrl?: string;
  imagePath?: string;
  audioUrl?: string;
  audioPath?: string;
  category?: string;
  pos?: string;
  gender?: string;
  example?: string;
  tags?: string[];
  quiz?: QuizEnrichment;
};

export type StudySession = {
  id: string;
  deckId: string;
  startedAt: number;
  endedAt?: number | null;
  durationMs?: number | null;
};

export type StudyHistory = {
  id: string;
  cardId: string;
  deckId: string;
  sessionId?: string | null;
  createdAt: number;
  rating: number;
  state: FsrsState;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
};

export type DeckAnalytics = {
  totals: {
    total: number;
    dueToday: number;
    newCount: number;
    learningCount: number;
    reviewCount: number;
    relearningCount: number;
  };
  retention: number;
  easeBuckets: { bucket: string; count: number }[];
  dailyHistory: { date: string; total: number; passed: number }[];
  ratingCounts: { rating: number; count: number }[];
  dueForecast: { date: string; count: number }[];
  timeSpent: { date: string; minutes: number }[];
  windowDaysUsed: number;
};
