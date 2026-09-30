import { useMutation } from '@tanstack/react-query';
import type { DeckTransferFormatId } from '@flashly/shared';
import { getApiClient } from '@/lib/api/client';

export interface ImportDeckResult {
  deckId: string;
  name: string;
  cardCount: number;
}

export interface DeckTransferSuccess<T> {
  success: true;
  data: T;
}

export interface DeckTransferFailure {
  success: false;
  error: { message: string };
}

export type DeckTransferResponse<T> = DeckTransferSuccess<T> | DeckTransferFailure;

export type DeckImportFormatId = 'flashly' | DeckTransferFormatId;

export interface FlashlyImportDeck {
  name: string;
  description?: string;
  materialType?: string;
  deckType?: string;
  locale?: string;
  accentKey?: string;
}

export interface FlashlyImportCard {
  front: string;
  back: string;
  imageUrl?: string;
  audioUrl?: string;
  category?: string;
  pos?: string;
  gender?: string;
  example?: string;
  tags?: string;
}

export interface FlashlyImportPayload {
  deck: FlashlyImportDeck;
  cards: FlashlyImportCard[];
}

type ImportDeckInput =
  | {
      formatId: 'flashly';
      payload: FlashlyImportPayload;
    }
  | {
      formatId: DeckTransferFormatId;
      fileContent: string;
      deckName?: string;
    };

interface ExportDeckInput {
  formatId: DeckTransferFormatId;
  deckId: string;
}

export function useDeckTransfer() {
  const importMutation = useMutation({
    mutationFn: async (input: ImportDeckInput) => {
      const api = getApiClient();
      if (!api) {
        throw new Error('API client not initialized');
      }

      if (input.formatId === 'flashly') {
        const result = await api.post<ImportDeckResult>('/api/decks/import/flashly', input.payload);
        return result.match(
          (data) => data,
          (error) => {
            throw new Error(error.message || 'Failed to import deck');
          }
        );
      }

      if (input.formatId === 'anki-csv') {
        const result = await api.post<ImportDeckResult>('/api/decks/import/anki-csv', {
          csv: input.fileContent,
          deckName: input.deckName?.trim() || undefined,
        });
        return result.match(
          (data) => data,
          (error) => {
            throw new Error(error.message || 'Failed to import deck');
          }
        );
      }

      const result = await api.post<ImportDeckResult>('/api/decks/import/quizlet', {
        content: input.fileContent,
        deckName: input.deckName?.trim() || undefined,
      });
      return result.match(
        (data) => data,
        (error) => {
          throw new Error(error.message || 'Failed to import deck');
        }
      );
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (input: ExportDeckInput) => {
      const api = getApiClient();
      if (!api) {
        throw new Error('API client not initialized');
      }

      const endpointByFormat: Record<DeckTransferFormatId, string> = {
        'anki-csv': `/api/decks/${input.deckId}/export/anki-csv`,
        'quizlet-txt': `/api/decks/${input.deckId}/export/quizlet`,
      };

      const result = await api.get<string>(endpointByFormat[input.formatId]);
      return result.match(
        (data) => data,
        (error) => {
          throw new Error(error.message || 'Failed to export deck');
        }
      );
    },
  });

  const importDeck = async (input: ImportDeckInput): Promise<DeckTransferResponse<ImportDeckResult>> => {
    try {
      const data = await importMutation.mutateAsync(input);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  };

  const exportDeck = async (input: ExportDeckInput): Promise<DeckTransferResponse<string>> => {
    try {
      const data = await exportMutation.mutateAsync(input);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  };

  return {
    importDeck,
    exportDeck,
    isImporting: importMutation.isPending,
    isExporting: exportMutation.isPending,
  };
}
