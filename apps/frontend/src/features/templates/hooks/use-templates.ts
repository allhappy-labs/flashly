/**
 * Hook for fetching templates
 */

import { useQuery } from '@tanstack/react-query';
import type { Template } from '../types/template.types';
import { getApiClient } from '@/lib/api/client';
import { unwrapResultOrThrow } from '@/lib/react-query/result-utils';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const api = getApiClient();
      if (!api) {
        throw new Error('API client not initialized');
      }
      const result = await api.get<Template[]>('/api/templates');
      return unwrapResultOrThrow(result, 'Failed to fetch templates');
    },
  });
}
