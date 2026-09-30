/**
 * Hook for fetching categories
 */

import { useQuery } from '@tanstack/react-query';
import type { Category, CategoryTree, CategoryDecksResponse } from '../types/category.types';
import { getApiClient } from '@/lib/api/client';
import { unwrapResultOrThrow } from '@/lib/react-query/result-utils';

export function useCategoryTree() {
  return useQuery({
    queryKey: ['categories-tree'],
    queryFn: async () => {
      const api = getApiClient();
      if (!api) {
        throw new Error('API client not initialized');
      }
      const result = await api.get<CategoryTree[]>('/api/categories/tree');
      return unwrapResultOrThrow(result, 'Failed to fetch categories');
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const api = getApiClient();
      if (!api) {
        throw new Error('API client not initialized');
      }
      const result = await api.get<Category[]>('/api/categories');
      return unwrapResultOrThrow(result, 'Failed to fetch categories');
    },
  });
}

export function useCategoryDecks(
  slug: string,
  options: { limit?: number; offset?: number; includeSubcategories?: boolean } = {}
) {
  return useQuery({
    queryKey: ['category-decks', slug, options.limit ?? null, options.offset ?? null, options.includeSubcategories ?? null],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.includeSubcategories !== undefined) {
        params.append('includeSubcategories', options.includeSubcategories.toString());
      }

      const api = getApiClient();
      if (!api) {
        throw new Error('API client not initialized');
      }
      const result = await api.get<CategoryDecksResponse>(`/api/categories/${slug}/decks?${params.toString()}`);
      return unwrapResultOrThrow(result, 'Failed to fetch category decks');
    },
    enabled: Boolean(slug),
  });
}
