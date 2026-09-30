/**
 * Export Service - Handle deck export in external text formats
 */

import { eq } from 'drizzle-orm';
import type { ResultAsync } from 'neverthrow';
import type {
  DatabaseError,
  NotFoundError} from '@flashly/shared';
import {
  errorFactory,
  getDeckTransferFormatAdapter,
  safeAsync,
  type DeckTransferFormatId,
  type DeckTransferPayload,
} from '@flashly/shared';
import { db } from '../../db/db.ts';
import { decks, cards } from '../auth/auth-schema.ts';

// ============================================================================
// EXPORT SERVICE
// ============================================================================

export class ExportService {
  private async loadOwnedDeck(userId: string, deckId: string) {
    const [deck] = await db
      .select()
      .from(decks)
      .where(eq(decks.id, deckId))
      .limit(1);

    if (!deck) {
      throw errorFactory.notFound('Deck not found');
    }

    if (deck.userId !== userId) {
      throw errorFactory.forbidden('You do not have permission to export this deck', {
        field: 'deckId',
      });
    }

    const deckCards = await db
      .select()
      .from(cards)
      .where(eq(cards.deckId, deckId));

    return { deck, deckCards };
  }

  private toTransferPayload(data: Awaited<ReturnType<ExportService['loadOwnedDeck']>>): DeckTransferPayload {
    return {
      deck: {
        name: data.deck.name,
        description: data.deck.description,
        materialType: data.deck.materialType,
        deckType: data.deck.deckType,
        locale: data.deck.locale,
        accentKey: data.deck.accentKey,
      },
      cards: data.deckCards.map((card) => ({
        front: card.front,
        back: card.back,
        imageUrl: card.imageUrl,
        audioUrl: card.audioUrl,
        category: card.category,
        pos: card.pos,
        gender: card.gender,
        example: card.example,
        tags: card.tags,
      })),
    };
  }

  private exportAsTextFormat(
    userId: string,
    deckId: string,
    formatId: DeckTransferFormatId
  ): ResultAsync<string, DatabaseError | NotFoundError> {
    return safeAsync(
      async () => {
        const data = await this.loadOwnedDeck(userId, deckId);
        const payload = this.toTransferPayload(data);
        const adapter = getDeckTransferFormatAdapter(formatId);
        return adapter.exportToText(payload);
      },
      (error) => errorFactory.database('Failed to export deck', { cause: error })
    );
  }

  exportAsAnkiCsv(
    userId: string,
    deckId: string
  ): ResultAsync<string, DatabaseError | NotFoundError> {
    return this.exportAsTextFormat(userId, deckId, 'anki-csv');
  }

  exportAsQuizlet(
    userId: string,
    deckId: string
  ): ResultAsync<string, DatabaseError | NotFoundError> {
    return this.exportAsTextFormat(userId, deckId, 'quizlet-txt');
  }
}

// Export singleton instance
export const exportService = new ExportService();
