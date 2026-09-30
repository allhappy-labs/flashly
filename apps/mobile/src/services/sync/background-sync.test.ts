import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSyncServiceMock = vi.fn();

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn(() => ({
      remove: vi.fn(),
    })),
  },
}));

vi.mock('./sync-service', () => ({
  getSyncService: () => getSyncServiceMock(),
}));

import { BackgroundSync, setUserIdGetter } from './background-sync';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('BackgroundSync', () => {
  beforeEach(() => {
    getSyncServiceMock.mockReset();
    setUserIdGetter(() => 'user-1');
  });

  it('skips sync when user is not authenticated', async () => {
    const incrementalSync = vi.fn();
    getSyncServiceMock.mockReturnValue({ incrementalSync });
    setUserIdGetter(() => null);

    const sync = new BackgroundSync();
    await sync.triggerSync();

    expect(incrementalSync).not.toHaveBeenCalled();
  });

  it('coalesces overlapping sync triggers into a single rerun', async () => {
    const firstRun = createDeferred<unknown>();
    const incrementalSync = vi
      .fn()
      .mockImplementationOnce(() => firstRun.promise)
      .mockResolvedValue({ isOk: () => true, isErr: () => false });
    getSyncServiceMock.mockReturnValue({ incrementalSync });

    const sync = new BackgroundSync();

    const firstTrigger = sync.triggerSync();
    const secondTrigger = sync.triggerSync();
    const thirdTrigger = sync.triggerSync();

    expect(incrementalSync).toHaveBeenCalledTimes(1);

    firstRun.resolve({ ok: true });
    await Promise.all([firstTrigger, secondTrigger, thirdTrigger]);

    expect(incrementalSync).toHaveBeenCalledTimes(2);
    expect(incrementalSync).toHaveBeenNthCalledWith(1, 'user-1', undefined);
    expect(incrementalSync).toHaveBeenNthCalledWith(2, 'user-1', undefined);
  });
});

