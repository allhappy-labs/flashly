import { beforeEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import {
  ImportError,
  isSafePackMediaPath,
  normalizeIncomingFlashlyUri,
  prepareImportPayload,
  readImportFile,
  readPreparedImportWithOwnership,
  resolveMediaForCards,
  type PreparedImportPayload,
  validateArchiveEntryBudgets,
  validateCoreImportText,
} from './importService';
import { storeDeckAudio, storeDeckImage } from './deckMedia';

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

vi.mock('./deckMedia', () => ({
  storeDeckAudio: vi.fn(),
  storeDeckImage: vi.fn(),
}));

describe('isSafePackMediaPath', () => {
  it('accepts media files inside pack folders', () => {
    expect(isSafePackMediaPath('media/images/card.jpg')).toBe(true);
    expect(isSafePackMediaPath('media/audio/card.mp3')).toBe(true);
  });

  it('rejects traversal and absolute paths', () => {
    expect(isSafePackMediaPath('../outside.jpg')).toBe(false);
    expect(isSafePackMediaPath('media/images/../../outside.jpg')).toBe(false);
    expect(isSafePackMediaPath('/media/images/card.jpg')).toBe(false);
  });
});

describe('normalizeIncomingFlashlyUri', () => {
  it('accepts file archives and opaque content routes without decoding document identifiers', () => {
    expect(normalizeIncomingFlashlyUri('file:///tmp/Deck.flashly')).toBe('file:///tmp/Deck.flashly');
    expect(
      normalizeIncomingFlashlyUri(
        'content://com.android.providers.downloads.documents/document/primary%3ADownload%2FDeck.flashly',
      ),
    ).toBe(
      'content://com.android.providers.downloads.documents/document/primary%3ADownload%2FDeck.flashly',
    );
    expect(
      normalizeIncomingFlashlyUri('content://com.android.providers.downloads.documents/document/8127'),
    ).toBe('content://com.android.providers.downloads.documents/document/8127');
  });

  it('rejects unsupported schemes and non-flashly file routes', () => {
    expect(normalizeIncomingFlashlyUri('https://example.test/Deck.flashly')).toBeNull();
    expect(normalizeIncomingFlashlyUri('file:///tmp/Deck.zip')).toBeNull();
  });
});

describe('archive size policy', () => {
  it('rejects an oversized declared core entry before decompression', () => {
    expect(() => validateArchiveEntryBudgets([
      {
        name: 'deck.jsonl',
        dir: false,
        _data: { uncompressedSize: 10 * 1024 * 1024 + 1 },
      },
    ])).toThrowError('IMPORT_CORE_DATA_TOO_LARGE');
  });

  it('rejects archives whose declared entries exceed the aggregate budget', () => {
    const entries = Array.from({ length: 6 }, (_, index) => ({
      name: `media/images/card-${index}.jpg`,
      dir: false,
      _data: { uncompressedSize: 18 * 1024 * 1024 },
    }));

    expect(() => validateArchiveEntryBudgets(entries)).toThrowError(
      'IMPORT_ARCHIVE_EXPANDED_TOO_LARGE',
    );
  });

  it('counts UTF-8 bytes for multibyte core text', () => {
    const text = '😀'.repeat(2_621_441);

    expect(() => validateCoreImportText(text)).toThrowError('IMPORT_CORE_DATA_TOO_LARGE');
  });

  it('uses picked file size before reading archive bytes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(readImportFile({
      uri: 'file:///cache/import.flashly',
      name: 'import.flashly',
      lastModified: 0,
      size: 50 * 1024 * 1024 + 1,
      isZip: true,
    })).rejects.toMatchObject({ code: 'IMPORT_ARCHIVE_TOO_LARGE' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('prepareImportPayload', () => {
  const payload = {
    name: 'import.flashly',
    config: { version: 1, deck: { name: 'Deck' } },
    text: '',
    isZip: true,
    cacheDirUri: 'file:///cache/import-1',
  };

  it('cleans the new staging cache and propagates invalid card data', () => {
    const cleanup = vi.fn();

    expect(() => prepareImportPayload({ ...payload, text: '{invalid' }, cleanup)).toThrowError(
      'IMPORT_INVALID_CARD_DATA',
    );
    expect(cleanup).toHaveBeenCalledWith('file:///cache/import-1');
  });

  it('cleans the new staging cache and propagates an empty card set', () => {
    const cleanup = vi.fn();

    expect(() => prepareImportPayload({ ...payload, text: '' }, cleanup)).toThrowError(
      'IMPORT_NO_CARDS',
    );
    expect(cleanup).toHaveBeenCalledWith('file:///cache/import-1');
  });
});

describe('readPreparedImportWithOwnership', () => {
  const prepared: PreparedImportPayload = {
    payload: {
      name: 'import.flashly',
      config: { version: 1, deck: { name: 'Deck' } },
      text: '{"front":"Front","back":"Back"}',
      isZip: true,
      cacheDirUri: 'file:///cache/import-deferred',
    },
    cards: [{ front: 'Front', back: 'Back' }],
  };

  it('deletes a returned cache instead of adopting it when the owner became inactive', async () => {
    let resolveRead: ((value: PreparedImportPayload) => void) | undefined;
    const deferredRead = new Promise<PreparedImportPayload>((resolve) => {
      resolveRead = resolve;
    });
    let active = true;
    let adopted: PreparedImportPayload | null = null;
    const deleted: Array<string | null | undefined> = [];

    const result = readPreparedImportWithOwnership(
      () => deferredRead,
      () => active,
      (value) => {
        adopted = value;
      },
      (cacheDirUri) => {
        deleted.push(cacheDirUri);
      },
    );
    active = false;
    resolveRead?.(prepared);

    await expect(result).resolves.toBe(false);
    expect(adopted).toBeNull();
    expect(deleted).toEqual(['file:///cache/import-deferred']);
  });

  it('transfers a returned cache to an active owner without deleting it', async () => {
    let adopted: PreparedImportPayload | null = null;
    const deleted: Array<string | null | undefined> = [];

    await expect(readPreparedImportWithOwnership(
      async () => prepared,
      () => true,
      (value) => {
        adopted = value;
      },
      (cacheDirUri) => {
        deleted.push(cacheDirUri);
      },
    )).resolves.toBe(true);

    expect(adopted).toBe(prepared);
    expect(deleted).toEqual([]);
  });
});

describe('ImportError', () => {
  it('uses a stable code rather than implementation copy', () => {
    expect(new ImportError('IMPORT_MISSING_CONFIG')).toMatchObject({
      code: 'IMPORT_MISSING_CONFIG',
      message: 'IMPORT_MISSING_CONFIG',
    });
  });
});

describe('resolveMediaForCards', () => {
  beforeEach(() => {
    vi.mocked(storeDeckImage).mockReset();
    vi.mocked(storeDeckAudio).mockReset();
  });

  it('copies available packaged media to persistent storage', async () => {
    vi.mocked(storeDeckImage).mockResolvedValue(
      'file:///documents/flashly-media/decks/deck-1/images/card.jpg',
    );

    const result = await resolveMediaForCards(
      [{ front: 'Front', back: 'Back', imagePath: 'media/images/card.jpg' }],
      { 'media/images/card.jpg': 'file:///cache/import/card.jpg' },
      null,
      'deck-1',
      'Deck',
      false,
    );

    expect(result.cards[0]?.imageUrl).toContain('/flashly-media/');
    expect(result.missingImages).toBe(0);
    expect(result.storedMediaUris).toEqual([
      'file:///documents/flashly-media/decks/deck-1/images/card.jpg',
    ]);
  });

  it('imports cards when optional media is missing', async () => {
    const result = await resolveMediaForCards(
      [{
        front: 'Front',
        back: 'Back',
        imagePath: 'media/images/missing.jpg',
        audioPath: 'media/audio/missing.mp3',
      }],
      {},
      {},
      'deck-1',
      'Deck',
      false,
    );

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.imageUrl).toBeUndefined();
    expect(result.cards[0]?.audioUrl).toBeUndefined();
    expect(result.missingImages).toBe(1);
    expect(result.missingAudio).toBe(1);
    expect(result.storedMediaUris).toEqual([]);
  });

  it('counts a staged-media copy failure as missing without retaining its cache URI', async () => {
    vi.mocked(storeDeckImage).mockResolvedValue('');

    const result = await resolveMediaForCards(
      [{ front: 'Front', back: 'Back', imagePath: 'media/images/raced.jpg' }],
      { 'media/images/raced.jpg': 'file:///cache/import/raced.jpg' },
      null,
      'deck-1',
      'Deck',
      false,
    );

    expect(result.cards[0]?.imageUrl).toBeUndefined();
    expect(result.missingImages).toBe(1);
    expect(result.storedMediaUris).toEqual([]);
  });

  it('clears remote references without fetching in local mode', async () => {
    const result = await resolveMediaForCards(
      [{
        front: 'Front',
        back: 'Back',
        imageUrl: 'https://cdn.example/card.jpg',
        audioUrl: 'https://cdn.example/card.mp3',
      }],
      null,
      null,
      'deck-1',
      'Deck',
      false,
    );

    expect(result.cards[0]?.imageUrl).toBeUndefined();
    expect(result.cards[0]?.audioUrl).toBeUndefined();
    expect(storeDeckImage).not.toHaveBeenCalled();
    expect(storeDeckAudio).not.toHaveBeenCalled();
  });
});

async function buildPack(imagePath: string) {
  const zip = new JSZip();
  zip.file('deck.config.json', JSON.stringify({
    version: 1,
    deck: { name: 'Imported deck', description: null },
  }));
  zip.file('deck.jsonl', JSON.stringify({
    front: 'Front',
    back: 'Back',
    imagePath,
    audioPath: 'media/audio/card.mp3',
  }));
  zip.file('media/images/card.jpg', 'image');
  zip.file('media/audio/card.mp3', 'audio');
  return zip.generateAsync({ type: 'arraybuffer' });
}

async function readPack(archive: ArrayBuffer) {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(archive));
  try {
    return await readImportFile({
      uri: 'file:///cache/import.flashly',
      name: 'import.flashly',
      lastModified: 0,
      isZip: true,
    });
  } finally {
    fetchSpy.mockRestore();
  }
}

describe('archive round trips', () => {
  it('finds packaged image and audio assets and stores app-owned media URIs', async () => {
    vi.mocked(storeDeckImage).mockResolvedValue('file:///documents/flashly-media/decks/deck-1/images/card.jpg');
    vi.mocked(storeDeckAudio).mockResolvedValue('file:///documents/flashly-media/decks/deck-1/audio/card.mp3');

    const payload = await readPack(await buildPack('media/images/card.jpg'));
    const result = await resolveMediaForCards(
      [{
        front: 'Front',
        back: 'Back',
        imagePath: 'media/images/card.jpg',
        audioPath: 'media/audio/card.mp3',
      }],
      payload.images ?? null,
      payload.audio ?? null,
      'deck-1',
      'Imported deck',
      false,
    );

    expect(payload.images?.['media/images/card.jpg']).toBeDefined();
    expect(payload.audio?.['media/audio/card.mp3']).toBeDefined();
    expect(result.cards[0]?.imageUrl).toContain('/flashly-media/');
    expect(result.cards[0]?.audioUrl).toContain('/flashly-media/');
  });

  it('imports a card when its declared image is absent from the archive', async () => {
    vi.mocked(storeDeckAudio).mockResolvedValue('file:///documents/flashly-media/decks/deck-1/audio/card.mp3');

    const payload = await readPack(await buildPack('media/images/missing.jpg'));
    const result = await resolveMediaForCards(
      [{
        front: 'Front',
        back: 'Back',
        imagePath: 'media/images/missing.jpg',
        audioPath: 'media/audio/card.mp3',
      }],
      payload.images ?? null,
      payload.audio ?? null,
      'deck-1',
      'Imported deck',
      false,
    );

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.imageUrl).toBeUndefined();
    expect(result.missingImages).toBe(1);
  });
});
