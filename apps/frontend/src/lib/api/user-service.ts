/**
 * User Service - API client for user profiles and follows
 */

import { getApiClient } from './client';
import type { UserProfile, UserDeck } from '@/features/users/types/user.types';

// ============================================================================
// User Profile Operations
// ============================================================================

/**
 * Get user profile
 */
export async function getUserProfile(userId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.get<UserProfile>(`/api/users/${userId}`);
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId: string, data: {
  bio?: string;
  website?: string;
  twitterHandle?: string;
}) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.patch<UserProfile>(`/api/users/${userId}`, data);
}

/**
 * Get user's public decks
 */
export async function getUserDecks(userId: string, options: {
  limit?: number;
  offset?: number;
} = {}) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.offset) params.append('offset', options.offset.toString());

  return api.get<{
    decks: UserDeck[];
    total: number;
  }>(`/api/users/${userId}/decks?${params.toString()}`);
}

// ============================================================================
// Follow Operations
// ============================================================================

/**
 * Follow a user
 */
export async function followUser(userId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.post(`/api/users/${userId}/follow`, {});
}

/**
 * Unfollow a user
 */
export async function unfollowUser(userId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.delete(`/api/users/${userId}/follow`);
}

/**
 * Get user's followers
 */
export async function getUserFollowers(userId: string, options: {
  limit?: number;
  offset?: number;
} = {}) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.offset) params.append('offset', options.offset.toString());

  return api.get<{
    users: Array<{
      id: string;
      name: string;
      username: string;
      image: string | null;
      bio: string | null;
    }>;
    total: number;
  }>(`/api/users/${userId}/followers?${params.toString()}`);
}

/**
 * Get user's following
 */
export async function getUserFollowing(userId: string, options: {
  limit?: number;
  offset?: number;
} = {}) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.offset) params.append('offset', options.offset.toString());

  return api.get<{
    users: Array<{
      id: string;
      name: string;
      username: string;
      image: string | null;
      bio: string | null;
    }>;
    total: number;
  }>(`/api/users/${userId}/following?${params.toString()}`);
}
