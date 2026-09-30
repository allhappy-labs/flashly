/**
 * Hook for following/unfollowing users
 */

import { useResultMutation } from '@/lib/react-query/result-utils';
import { followUser, unfollowUser } from '@/lib/api/user-service';

export function useFollow(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation(
    (userId: string) => followUser(userId),
    options
  );
}

export function useUnfollow(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation(
    (userId: string) => unfollowUser(userId),
    options
  );
}
