import type { ResultAsync} from 'neverthrow';
import { errAsync } from 'neverthrow';
import type { ApiError, ValidationError } from '@flashly/shared';
import { NetworkError } from '@flashly/shared';
import { getMobileApiClient } from '../../lib/api/client';
import type { DeckAnalytics } from '../../types/models';

export function fetchDeckAnalytics(deckId: string, windowDays: number): ResultAsync<DeckAnalytics, NetworkError | ApiError | ValidationError> {
  const api = getMobileApiClient();
  if (!api) {
    return errAsync(new NetworkError('API client not initialized'));
  }

  const params = new URLSearchParams();
  params.append('windowDays', String(windowDays));

  return api.get<DeckAnalytics>(`/api/analytics/decks/${deckId}/detail?${params.toString()}`);
}
