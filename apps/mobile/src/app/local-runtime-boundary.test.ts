import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('LocalAppRuntime import boundary', () => {
  it('does not import hosted startup modules', () => {
    const runtimePath = fileURLToPath(
      new URL('./LocalAppRuntime.tsx', import.meta.url).href,
    );
    const source = readFileSync(runtimePath, 'utf8');
    const forbiddenImports = [
      'services/auth',
      'services/init',
      'lib/api',
      'lib/trpc',
      'services/sync',
      'services/marketplace',
      '@react-native-community/netinfo',
    ];

    for (const forbiddenImport of forbiddenImports) {
      expect(source).not.toContain(forbiddenImport);
    }
  });
});
