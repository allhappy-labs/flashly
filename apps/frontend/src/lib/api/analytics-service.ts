/**
 * Analytics Service - API client for analytics data
 */

import { getApiClient } from './client';

// ============================================================================
// Types
// ============================================================================

export interface UserStats {
  totalDecks: number;
  totalCards: number;
  totalStudyTime: number;
  cardsStudied: number;
  cardsLearned: number;
  cardsReviewing: number;
  averageAccuracy: number;
  studyStreak: number;
  decksStudiedThisWeek: number;
  cardsStudiedThisWeek: number;
}

export interface DeckStats {
  deckId: string;
  deckName: string;
  totalCards: number;
  cardsStudied: number;
  cardsLearned: number;
  cardsReviewing: number;
  averageAccuracy: number;
  totalStudyTime: number;
  lastStudiedAt: Date | string | null;
  studySessions: number;
  masteryLevel: number;
}

export interface MasteryProgress {
  notStudied: number;
  learning: number;
  mastered: number;
}

export interface StudyTimeData {
  date: string;
  studyTime: number;
  cardsStudied: number;
}

export interface DeckAnalyticsDetail {
  totals: {
    total: number;
    dueToday: number;
    newCount: number;
    learningCount: number;
    reviewCount: number;
    relearningCount: number;
  };
  retention: number;
  easeBuckets: Array<{ bucket: string; count: number }>;
  dailyHistory: Array<{ date: string; total: number; passed: number }>;
  ratingCounts: Array<{ rating: number; count: number }>;
  dueForecast: Array<{ date: string; count: number }>;
  timeSpent: Array<{ date: string; minutes: number }>;
  windowDaysUsed: number;
}

// ============================================================================
// Analytics Operations
// ============================================================================

/**
 * Get user statistics
 */
export async function getUserStats() {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.get<UserStats>('/api/analytics/user');
}

/**
 * Get deck statistics
 */
export async function getDeckStats(deckId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.get<DeckStats>(`/api/analytics/decks/${deckId}`);
}

/**
 * Get mastery progress for a deck
 */
export async function getMasteryProgress(deckId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.get<MasteryProgress>(`/api/analytics/decks/${deckId}/mastery`);
}

/**
 * Get study time data
 */
export async function getStudyTimeData(days: number = 30) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.get<StudyTimeData[]>(`/api/analytics/user/study-time?days=${days}`);
}

/**
 * Get detailed analytics for a specific deck
 */
export async function getDeckAnalyticsDetail(deckId: string, windowDays: number = 30) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.get<DeckAnalyticsDetail>(`/api/analytics/decks/${deckId}/detail?windowDays=${windowDays}`);
}
