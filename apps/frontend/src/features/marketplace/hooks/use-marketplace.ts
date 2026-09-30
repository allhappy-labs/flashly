/**
 * Hook for browsing the marketplace
 */

import { useQuery } from '@tanstack/react-query';
import { browseMarketplace } from '@/lib/api/deck-service';
import type { MarketplaceQuery } from '@/types/api.types';

export function useMarketplace(query: MarketplaceQuery = {}) {
  return useQuery({
    queryKey: [
      'marketplace',
      query.materialType,
      query.deckType,
      query.locale,
      query.level,
      query.skill,
      query.regionalVariant,
      query.hasAudio,
      query.script,
      query.romanization,
      query.licenseCode,
      query.search,
      query.sortBy,
      query.page,
      query.limit,
    ],
    queryFn: async () => {
      const result = await browseMarketplace(query);
      return result.match(
        (data) => data,
        (error) => {
          throw error;
        }
      );
    },
  });
}
