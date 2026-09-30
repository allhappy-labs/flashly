import type { AppMode } from '../config/app-mode';

type RuntimeModule<T> = Readonly<{ default: T }>;

export type RuntimeLoaders<T> = Readonly<{
  local: () => Promise<RuntimeModule<T>>;
  hosted: () => Promise<RuntimeModule<T>>;
}>;

export function loadAppRuntime<T>(
  mode: AppMode,
  loaders: RuntimeLoaders<T>,
): Promise<RuntimeModule<T>> {
  return mode === 'hosted' ? loaders.hosted() : loaders.local();
}
