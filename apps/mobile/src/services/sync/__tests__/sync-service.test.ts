/**
 * Tests for Sync Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { okAsync, errAsync } from 'neverthrow';
import { NetworkError } from '@flashly/shared';
import { createSyncService } from '../sync-service';
import { MobileApiClient, setMobileApiClient } from '../../../lib/api/client';

const mockSyncRepository = vi.hoisted(() => ({
  getSyncState: vi.fn(),
  initializeSyncState: vi.fn(),
  claimAnonymousOperations: vi.fn(),
  getPendingOperations: vi.fn(),
  markOperationFailed: vi.fn(),
  markOperationComplete: vi.fn(),
  getPendingCount: vi.fn(),
  updateSyncState: vi.fn(),
}));

const mockStudyEventRepository = vi.hoisted(() => ({
  getPendingEvents: vi.fn(),
  markEventsFailed: vi.fn(),
  markEventsAccepted: vi.fn(),
  claimAnonymousEvents: vi.fn(),
}));

vi.mock('../sync-repository', () => ({
  getSyncRepository: () => mockSyncRepository,
}));

vi.mock('../study-event-repository', () => ({
  getStudyEventRepository: () => mockStudyEventRepository,
}));

const mockApiClient = new MobileApiClient({
  baseUrl: 'http://localhost',
});

describe('SyncService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    setMobileApiClient(mockApiClient);

    mockSyncRepository.getSyncState.mockReturnValue(okAsync({
      id: 'user-123',
      lastSyncAt: 0,
      pendingUploads: 0,
      pendingDownloads: 0,
      syncCursor: null,
    }));
    mockSyncRepository.initializeSyncState.mockReturnValue(okAsync({
      id: 'user-123',
      lastSyncAt: 0,
      pendingUploads: 0,
      pendingDownloads: 0,
      syncCursor: null,
    }));
    mockSyncRepository.claimAnonymousOperations.mockReturnValue(okAsync(undefined));
    mockSyncRepository.getPendingOperations.mockReturnValue(okAsync([]));
    mockSyncRepository.markOperationFailed.mockReturnValue(okAsync(undefined));
    mockSyncRepository.markOperationComplete.mockReturnValue(okAsync(undefined));
    mockSyncRepository.getPendingCount.mockReturnValue(okAsync(0));
    mockSyncRepository.updateSyncState.mockReturnValue(okAsync(undefined));

    mockStudyEventRepository.getPendingEvents.mockReturnValue(okAsync([]));
    mockStudyEventRepository.markEventsFailed.mockReturnValue(okAsync(undefined));
    mockStudyEventRepository.markEventsAccepted.mockReturnValue(okAsync(undefined));
    mockStudyEventRepository.claimAnonymousEvents.mockReturnValue(okAsync(undefined));
  });

  describe('incrementalSync', () => {
    it('should successfully perform incremental sync', async () => {
      const postMock = vi.spyOn(mockApiClient, 'post');
      mockStudyEventRepository.getPendingEvents.mockReturnValueOnce(okAsync([
        { id: 'evt-1', eventType: 'review', payload: '{}', createdAt: 0, retries: 0 },
      ]));
      postMock
        .mockReturnValueOnce(okAsync({ acceptedIds: [] }))
        .mockReturnValueOnce(okAsync({
          uploaded: 0,
          downloaded: 0,
          deleted: 0,
          changes: [],
          cursor: 'next-cursor',
          hasMore: false,
        }));

      const syncService = createSyncService();
      const result = await syncService.incrementalSync('user-123');

      expect(result.isOk()).toBe(true);
      expect(postMock).toHaveBeenCalledWith('/api/sync/incremental', expect.any(Object));
    });

    it('should handle sync errors gracefully', async () => {
      const postMock = vi.spyOn(mockApiClient, 'post');
      postMock.mockReturnValueOnce(errAsync(new NetworkError('Network error')));

      const syncService = createSyncService();
      const result = await syncService.incrementalSync('user-123');

      expect(result.isErr()).toBe(true);
    });
  });

  describe('fullSync', () => {
    it('should perform full sync when requested', async () => {
      const postMock = vi.spyOn(mockApiClient, 'post');
      postMock
        .mockReturnValueOnce(okAsync({ acceptedIds: [] }))
        .mockReturnValueOnce(okAsync({
          uploaded: 0,
          downloaded: 0,
          deleted: 0,
          changes: [],
          cursor: null,
          hasMore: false,
        }));

      const syncService = createSyncService();
      const result = await syncService.fullSync('user-123');

      expect(result.isOk()).toBe(true);
      expect(postMock).toHaveBeenCalledWith('/api/sync/incremental', expect.any(Object));
    });
  });
});
