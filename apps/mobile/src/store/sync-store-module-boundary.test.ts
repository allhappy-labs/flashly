import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('../services/sync/sync-service');
  vi.resetModules();
});

describe('sync store module boundary', () => {
  it('does not evaluate the hosted sync service until a hosted sync action runs', async () => {
    vi.resetModules();
    vi.doMock('../services/sync/sync-service', () => {
      throw new Error('Hosted sync service was evaluated');
    });

    await expect(import('./sync-store')).resolves.toBeDefined();
  });
});
