import { upsertDeckFromSync } from '../../db/deckRepositorySafe';
import { toRecord } from '../../utils/records';

type RefreshDeckById = (deckId: string) => Promise<void>;

export async function applyMarketplaceCloneToLocalLibrary(
  clonedDeck: unknown,
  refreshDeckById: RefreshDeckById,
): Promise<boolean> {
  const syncPayload = toRecord(clonedDeck);
  if (!syncPayload) {
    return false;
  }

  const deckId = typeof syncPayload.id === 'string' ? syncPayload.id : null;
  if (!deckId) {
    return false;
  }

  const localDeckUpsert = await upsertDeckFromSync(syncPayload);
  if (localDeckUpsert.isErr()) {
    return false;
  }

  await refreshDeckById(deckId);
  return true;
}
