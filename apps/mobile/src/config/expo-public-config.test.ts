import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

describe('Expo public config', () => {
  it('does not emit the removed New Architecture config flag', () => {
    const sourceConfig: unknown = JSON.parse(
      readFileSync(resolve(process.cwd(), 'app.json'), 'utf8'),
    );
    const sourceExpo =
      isRecord(sourceConfig) && isRecord(sourceConfig.expo)
        ? sourceConfig.expo
        : undefined;
    const sourceAndroid = isRecord(sourceExpo?.android)
      ? sourceExpo.android
      : undefined;

    expect(sourceExpo).not.toHaveProperty('newArchEnabled');
    expect(sourceExpo).not.toHaveProperty('splash');
    expect(sourceAndroid).not.toHaveProperty('edgeToEdgeEnabled');
  });

  it('registers the flashly deep-link scheme', () => {
    const output = execFileSync(
      'pnpm',
      ['exec', 'expo', 'config', '--type', 'public', '--json'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    const parsed: unknown = JSON.parse(output);
    const scheme = isRecord(parsed) ? parsed.scheme : undefined;

    expect(scheme).toBe('flashly');
  });

  it('registers a content-only Android archive intent filter using the supported Expo config shape', () => {
    const output = execFileSync(
      'pnpm',
      ['exec', 'expo', 'config', '--type', 'public', '--json'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    const parsed: unknown = JSON.parse(output);
    const android = isRecord(parsed) && isRecord(parsed.android) ? parsed.android : undefined;
    const intentFilters = android?.intentFilters;

    expect(Array.isArray(intentFilters)).toBe(true);
    const archiveFilter = Array.isArray(intentFilters) ? intentFilters[0] : undefined;
    expect(isRecord(archiveFilter)).toBe(true);
    if (!isRecord(archiveFilter)) return;
    expect(archiveFilter).toMatchObject({
      action: 'VIEW',
      category: ['BROWSABLE', 'DEFAULT'],
    });
    expect('categories' in archiveFilter).toBe(false);

    const data = archiveFilter.data;
    expect(Array.isArray(data)).toBe(true);
    const supportedMimeTypes = Array.isArray(data)
      ? data.flatMap((entry) => isRecord(entry) && typeof entry.mimeType === 'string' ? [entry.mimeType] : [])
      : [];
    const schemes = Array.isArray(data)
      ? data.flatMap((entry) => isRecord(entry) && typeof entry.scheme === 'string' ? [entry.scheme] : [])
      : [];

    expect(supportedMimeTypes).toEqual([
      'application/zip',
      'application/x-zip-compressed',
      'application/x-zip',
      'application/octet-stream',
    ]);
    expect(schemes).toEqual(['content', 'content', 'content', 'content']);
  });

  it('registers Flashly deck documents and regenerates iOS metadata before builds', () => {
    const output = execFileSync(
      'pnpm',
      ['exec', 'expo', 'config', '--type', 'public', '--json'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    const parsed: unknown = JSON.parse(output);
    const ios = isRecord(parsed) && isRecord(parsed.ios) ? parsed.ios : undefined;
    const infoPlist = ios?.infoPlist;

    expect(infoPlist).toMatchObject({
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'Flashly Deck',
          CFBundleTypeRole: 'Editor',
          LSHandlerRank: 'Owner',
          LSItemContentTypes: ['com.flashly.deck'],
        },
      ],
      UTExportedTypeDeclarations: [
        {
          UTTypeIdentifier: 'com.flashly.deck',
          UTTypeConformsTo: ['public.zip-archive', 'public.data'],
          UTTypeTagSpecification: {
            'public.filename-extension': ['flashly'],
          },
        },
      ],
    });

    const packageJson: unknown = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    );
    const scripts = isRecord(packageJson) && isRecord(packageJson.scripts)
      ? packageJson.scripts
      : undefined;

    expect(scripts?.ios).toBe(
      'expo prebuild --platform ios --no-install && expo run:ios',
    );
  });

  it('uses the layered Composer icon and platform fallbacks', () => {
    const output = execFileSync(
      'pnpm',
      ['exec', 'expo', 'config', '--type', 'public', '--json'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    const parsed: unknown = JSON.parse(output);
    const ios = isRecord(parsed) && isRecord(parsed.ios) ? parsed.ios : undefined;
    const android =
      isRecord(parsed) && isRecord(parsed.android) ? parsed.android : undefined;
    const adaptiveIcon = isRecord(android?.adaptiveIcon)
      ? android.adaptiveIcon
      : undefined;
    const web = isRecord(parsed) && isRecord(parsed.web) ? parsed.web : undefined;
    const plugins = isRecord(parsed) && Array.isArray(parsed.plugins)
      ? parsed.plugins
      : [];
    const splashPlugin = plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    );
    const splashPluginConfig =
      Array.isArray(splashPlugin) && isRecord(splashPlugin[1])
        ? splashPlugin[1]
        : undefined;

    expect(isRecord(parsed) ? parsed.icon : undefined).toBe(
      './assets/icon.png',
    );
    expect(splashPluginConfig).toMatchObject({
      image: './assets/splash-logo-mark.png',
      imageWidth: 220,
      resizeMode: 'contain',
      backgroundColor: '#062A2E',
    });
    expect(ios?.icon).toBe('./assets/app.icon');
    expect(adaptiveIcon).toMatchObject({
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FEA747',
    });
    expect(web?.favicon).toBe('./assets/favicon.png');
  });
});
