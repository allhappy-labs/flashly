/**
 * Import Service - Handle deck import from various formats
 */

import type { ResultAsync } from 'neverthrow';
import { errAsync } from 'neverthrow';
import {
  ValidationError,
  createId,
  errorFactory,
  getDeckTransferFormatAdapter,
  safeAsync,
  type DeckTransferFormatId,
  type DeckTransferPayload,
  type DatabaseError,
} from '@flashly/shared';
import { db } from '../../db/db.ts';
import { decks, cards } from '../auth/auth-schema.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface ImportDeckInput {
  name: string;
  description?: string;
  materialType?: string;
  deckType?: string;
  locale?: string;
  accentKey?: string;
  cards: Array<{
    front: string;
    back: string;
    imageUrl?: string;
    audioUrl?: string;
    category?: string;
    pos?: string;
    gender?: string;
    example?: string;
    tags?: string;
  }>;
}

export interface ImportResult {
  deckId: string;
  name: string;
  cardCount: number;
}

// ============================================================================
// IMPORT SERVICE
// ============================================================================

export class ImportService {
  private mapImportError(error: unknown): DatabaseError | ValidationError {
    if (error instanceof ValidationError) {
      return error;
    }

    return errorFactory.database('Failed to import deck', { cause: error });
  }

  private validatePayload(payload: DeckTransferPayload) {
    if (!payload.deck?.name || payload.deck.name.trim().length === 0) {
      throw errorFactory.validation('Deck name is required', { field: 'deck.name' });
    }

    if (!Array.isArray(payload.cards) || payload.cards.length === 0) {
      throw errorFactory.validation('Deck must have at least one card', { field: 'cards' });
    }

    for (let i = 0; i < payload.cards.length; i += 1) {
      const card = payload.cards[i];
      if (!card.front || card.front.trim().length === 0) {
        throw errorFactory.validation(`Card at index ${i} is missing front text`, {
          field: `cards[${i}].front`,
        });
      }
      if (!card.back || card.back.trim().length === 0) {
        throw errorFactory.validation(`Card at index ${i} is missing back text`, {
          field: `cards[${i}].back`,
        });
      }
    }
  }

  private async createDeckFromPayload(userId: string, payload: DeckTransferPayload): Promise<ImportResult> {
    this.validatePayload(payload);

    const deckId = createId();
    const now = new Date();

    await db.insert(decks).values({
      id: deckId,
      userId,
      name: payload.deck.name.trim(),
      description: payload.deck.description?.trim() || null,
      materialType: payload.deck.materialType || null,
      deckType: payload.deck.deckType || null,
      locale: payload.deck.locale || null,
      accentKey: payload.deck.accentKey || null,
      visibility: 'private',
      isFeatured: false,
      downloadCount: 0,
      viewCount: 0,
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
      lastStudiedAt: null,
      isTemplate: false,
      templateId: null,
      templateData: null,
    });

    const cardsToInsert = payload.cards.map((card) => ({
      id: createId(),
      deckId,
      front: card.front.trim(),
      back: card.back.trim(),
      imageUrl: card.imageUrl || null,
      audioUrl: card.audioUrl || null,
      category: card.category || null,
      pos: card.pos || null,
      gender: card.gender || null,
      example: card.example || null,
      tags: card.tags || null,
      isStarred: false,
      learnState: null,
      learnCorrectStreak: null,
      learnCorrectTotal: null,
      learnIncorrectTotal: null,
      learnLastAnsweredAt: null,
      createdAt: now,
      updatedAt: now,
      lastReviewedAt: null,
      due: null,
      stability: null,
      difficulty: null,
      elapsed_days: null,
      scheduled_days: null,
      learning_steps: null,
      reps: null,
      lapses: null,
      state: null,
    }));

    await db.insert(cards).values(cardsToInsert);

    return {
      deckId,
      name: payload.deck.name.trim(),
      cardCount: payload.cards.length,
    };
  }

  private importFromTextFormat(
    userId: string,
    formatId: DeckTransferFormatId,
    content: string,
    options?: { deckName?: string }
  ): ResultAsync<ImportResult, DatabaseError | ValidationError> {
    return safeAsync(
      async () => {
        const adapter = getDeckTransferFormatAdapter(formatId);
        let payload: DeckTransferPayload;

        try {
          payload = adapter.importFromText(content, { deckName: options?.deckName });
        } catch (error) {
          throw errorFactory.validation(
            error instanceof Error ? error.message : 'Invalid import payload',
            { field: 'content' }
          );
        }

        if (options?.deckName?.trim()) {
          payload.deck.name = options.deckName.trim();
        }

        return this.createDeckFromPayload(userId, payload);
      },
      (error) => this.mapImportError(error)
    );
  }

  /**
   * Import deck from Flashly bundle payload
   */
  importFromFlashly(
    userId: string,
    payload: ImportDeckInput
  ): ResultAsync<ImportResult, DatabaseError | ValidationError> {
    if (!payload || typeof payload !== 'object') {
      return errAsync(errorFactory.validation('Invalid import payload', { field: 'payload' }));
    }
    const normalizedPayload: DeckTransferPayload = {
      deck: {
        name: payload.name,
        description: payload.description,
        materialType: payload.materialType,
        deckType: payload.deckType,
        locale: payload.locale,
        accentKey: payload.accentKey,
      },
      cards: payload.cards.map((card) => ({
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
    return safeAsync(
      async () => this.createDeckFromPayload(userId, normalizedPayload),
      (error) => this.mapImportError(error),
    );
  }

  /**
   * Import deck from external Anki CSV format
   */
  importFromAnkiCsv(
    userId: string,
    csvContent: string,
    deckName?: string
  ): ResultAsync<ImportResult, DatabaseError | ValidationError> {
    return this.importFromTextFormat(userId, 'anki-csv', csvContent, {
      deckName: deckName?.trim(),
    });
  }

  /**
   * Import deck from external Quizlet text format
   */
  importFromQuizlet(
    userId: string,
    content: string,
    deckName?: string
  ): ResultAsync<ImportResult, DatabaseError | ValidationError> {
    return this.importFromTextFormat(userId, 'quizlet-txt', content, {
      deckName: deckName?.trim(),
    });
  }
}

// Export singleton instance
export const importService = new ImportService();
