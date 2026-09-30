import { File } from 'expo-file-system';
import { describe, expect, it, vi } from 'vitest';
import { deleteStoredMediaFiles, storeDeckAudio, storeDeckImage } from './deckMedia';

vi.mock('react-native', () => ({
  Platform: { OS: 'test' },
}));

describe('deck media storage', () => {
  it('does not retain remote media URLs in local mode', async () => {
    await expect(
      storeDeckImage({
        deckId: 'deck-1',
        deckName: 'Deck',
        sourceUri: 'https://cdn.example/card.jpg',
      }),
    ).resolves.toBe('');
    await expect(
      storeDeckAudio({
        deckId: 'deck-1',
        deckName: 'Deck',
        sourceUri: 'http://cdn.example/card.mp3',
      }),
    ).resolves.toBe('');
  });

  it('fails closed when a non-web local source file is missing or a data URI is malformed', async () => {
    await expect(
      storeDeckImage({
        deckId: 'deck-1',
        deckName: 'Deck',
        sourceUri: 'file:///cache/import/missing.jpg',
      }),
    ).resolves.toBe('');
    await expect(
      storeDeckImage({
        deckId: 'deck-1',
        deckName: 'Deck',
        sourceUri: 'data:image/jpeg;base64,not-base64!',
      }),
    ).resolves.toBe('');
  });

  it('fails closed when a staged source disappears before it can produce a persistent copy', async () => {
    const source = new File('file:///cache/import/raced.jpg');
    source.create({ intermediates: true });
    source.write('aW1hZ2U=', { encoding: 'base64' });
    const copySpy = vi
      .spyOn(File.prototype, 'copy')
      .mockResolvedValue(undefined);

    await expect(
      storeDeckImage({
        deckId: 'deck-1',
        deckName: 'Deck',
        sourceUri: source.uri,
      }),
    ).resolves.toBe('');

    copySpy.mockRestore();
  });

  it('waits for an asynchronous persistent media copy', async () => {
    const source = new File('file:///cache/import/card.jpg');
    source.create({ intermediates: true });
    source.write('aW1hZ2U=', { encoding: 'base64' });

    await expect(
      storeDeckImage({
        deckId: 'deck-1',
        deckName: 'Deck',
        sourceUri: source.uri,
      }),
    ).resolves.toMatch(/\/flashly-media\/decks\/deck-1\/images\//);
  });

  it('deletes only attempt-created files under the managed media root', () => {
    const deleteSpy = vi.spyOn(File.prototype, 'delete');

    deleteStoredMediaFiles([
      'file:///tmp/flashly-media/decks/deck-1/images/card.jpg',
      'file:///other/flashly-media/decks/deck-1/images/deceptive.jpg',
      'file://evil/tmp/flashly-media/decks/deck-1/images/deceptive.jpg',
      'file:///tmp/flashly-media-evil/decks/deck-1/images/deceptive.jpg',
      'file:///tmp/flashly-media/decks/../../outside.jpg',
      'file:///tmp/other-app/card.jpg',
    ]);

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    deleteSpy.mockRestore();
  });
});
