/**
 * Tests for Sync Repository
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
vi.mock('../../../db/database', () => ({
  getDb: vi.fn(),
}));

describe('SyncRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enqueueOperation', () => {
    it('should successfully enqueue a sync operation', async () => {
      const { getDb } = await import('../../../db/database');
      const { getSyncRepository } = await import('../sync-repository');
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as never);

      const syncRepo = getSyncRepository();
      const result = await syncRepo.enqueueOperation('deck', 'deck-123', 'create', {
        name: 'Test Deck',
        visibility: 'private',
      });

      expect(result.isOk()).toBe(true);
    });

    it('should handle database errors', async () => {
      const { getDb } = await import('../../../db/database');
      const { getSyncRepository } = await import('../sync-repository');
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockRejectedValue(new Error('DB Error')),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as never);

      const syncRepo = getSyncRepository();
      const result = await syncRepo.enqueueOperation('deck', 'deck-123', 'create', {});

      expect(result.isErr()).toBe(true);
    });

    it('preserves quiz enrichment in queued card upload payloads', async () => {
      const { serializeSyncQueuePayload } = await import('../sync-repository');

      const quiz = {
        prompt: 'Which state change is evaporation?',
        options: ['liquid to gas', 'gas to liquid'],
        correctAnswer: 'liquid to gas',
        explanation: 'Evaporation changes a liquid into a gas.',
      };
      const payload = serializeSyncQueuePayload({ quiz });

      expect(JSON.parse(payload)).toEqual({ quiz });
    });

    it('preserves valid quiz enrichment through sync serialization', async () => {
      const { parseQuiz, serializeQuiz } = await import('../../../db/deckRepositorySafe');
      const quiz = {
        prompt: 'Which state change is evaporation?',
        options: ['liquid to gas', 'gas to liquid'],
        correctAnswer: 'liquid to gas',
        explanation: 'Evaporation changes a liquid into a gas.',
      };
      expect(parseQuiz(serializeQuiz(quiz))).toEqual(quiz);
    });
  });

  describe('getPendingOperations', () => {
    it('should return pending operations', async () => {
      const { getDb } = await import('../../../db/database');
      const { getSyncRepository } = await import('../sync-repository');
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { id: 'op-1', entityType: 'deck', operation: 'create' },
                  { id: 'op-2', entityType: 'card', operation: 'update' },
                ]),
              }),
            }),
          }),
        }),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as never);

      const syncRepo = getSyncRepository();
      const result = await syncRepo.getPendingOperations();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
      }
    });
  });
});
