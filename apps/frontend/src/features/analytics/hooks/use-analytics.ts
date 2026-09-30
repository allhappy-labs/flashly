/**
 * Hook for fetching analytics data
 */

import { useQuery } from '@tanstack/react-query';
import { unwrapResultOrThrow } from '@/lib/react-query/result-utils';
import {
  getUserStats,
  getDeckStats,
  getDeckAnalyticsDetail,
  getMasteryProgress,
  getStudyTimeData,
} from '@/lib/api/analytics-service';

export function useUserStats() {
  return useQuery({
    queryKey: ['user-stats'],
    queryFn: async () => unwrapResultOrThrow(await getUserStats()),
  });
}

export function useDeckStats(deckId: string) {
  return useQuery({
    queryKey: ['deck-stats', deckId],
    queryFn: async () => unwrapResultOrThrow(await getDeckStats(deckId)),
    enabled: Boolean(deckId),
  });
}

export function useMasteryProgress(deckId: string) {
  return useQuery({
    queryKey: ['mastery-progress', deckId],
    queryFn: async () => unwrapResultOrThrow(await getMasteryProgress(deckId)),
    enabled: Boolean(deckId),
  });
}

export function useStudyTimeData(days: number = 30) {
  return useQuery({
    queryKey: ['study-time', days],
    queryFn: async () => unwrapResultOrThrow(await getStudyTimeData(days)),
  });
}

export function useDeckAnalyticsDetail(deckId: string, windowDays: number, enabled: boolean = true) {
  return useQuery({
    queryKey: ['deck-analytics-detail', deckId, windowDays],
    queryFn: async () => unwrapResultOrThrow(await getDeckAnalyticsDetail(deckId, windowDays)),
    enabled: enabled && Boolean(deckId),
  });
}
