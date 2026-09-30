import { describe, expect, it, vi } from 'vitest';
import { loadAppRuntime } from './app-runtime-loader';

describe('loadAppRuntime', () => {
  it('loads only the local runtime in local mode', async () => {
    const local = vi.fn(async () => ({ default: 'local-runtime' }));
    const hosted = vi.fn(async () => ({ default: 'hosted-runtime' }));

    await expect(loadAppRuntime('local', { local, hosted })).resolves.toEqual({
      default: 'local-runtime',
    });
    expect(local).toHaveBeenCalledOnce();
    expect(hosted).not.toHaveBeenCalled();
  });

  it('loads only the hosted runtime in hosted mode', async () => {
    const local = vi.fn(async () => ({ default: 'local-runtime' }));
    const hosted = vi.fn(async () => ({ default: 'hosted-runtime' }));

    await expect(loadAppRuntime('hosted', { local, hosted })).resolves.toEqual({
      default: 'hosted-runtime',
    });
    expect(hosted).toHaveBeenCalledOnce();
    expect(local).not.toHaveBeenCalled();
  });
});
