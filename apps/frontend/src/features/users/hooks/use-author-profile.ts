/**
 * Hook for fetching author profile
 */

import { useQuery } from '@tanstack/react-query';
import { getUserDecks, getUserProfile, updateUserProfile } from '@/lib/api/user-service';
import { unwrapResultOrThrow, useResultMutation } from '@/lib/react-query/result-utils';
import type { UserProfile } from '../types/user.types';

export function useAuthorProfile(userId: string, options?: { executeOnMount?: boolean }) {
  return useQuery({
    queryKey: ['author-profile', userId],
    queryFn: async () => unwrapResultOrThrow(await getUserProfile(userId)),
    enabled: (options?.executeOnMount ?? true) && Boolean(userId),
  });
}

export function useAuthorDecks(userId: string, options: { limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: ['author-decks', userId, options.limit ?? null, options.offset ?? null],
    queryFn: async () => unwrapResultOrThrow(await getUserDecks(userId, options)),
    enabled: Boolean(userId),
  });
}

export const useUserDecks = useAuthorDecks;

export function useUpdateProfile(options?: {
  onSuccess?: (profile: UserProfile) => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation(
    (args: { userId: string; data: { bio?: string; website?: string; twitterHandle?: string } }) =>
      updateUserProfile(args.userId, args.data),
    options
  );
}
