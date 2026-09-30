import { File } from 'expo-file-system';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card, DeckWithStats } from '../types/models';
import { buildDeckArchive } from './exportService';
import { parseCardsFromText, readImportFile } from './importService';

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Share: { share: vi.fn() },
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('export and import archive integration', () => {
  it('preserves valid quiz enrichment through an archive round trip', async () => {
    const deck: DeckWithStats = {
      id: 'deck-1',
      name: 'Science',
      createdAt: 1,
      updatedAt: 1,
      cardCount: 1,
      dueCount: 0,
      newCount: 1,
      learningCount: 0,
      reviewCount: 0,
      relearningCount: 0,
      retention: 1,
    };
    const quiz = {
      prompt: 'Which state change is evaporation?',
      options: ['liquid to gas', 'gas to liquid'],
      correctAnswer: 'liquid to gas',
      explanation: 'Evaporation changes a liquid into a gas.',
    };
    const card: Card = {
      id: 'card-1',
      deckId: 'deck-1',
      front: 'Water',
      back: 'H2O',
      quiz,
      createdAt: 1,
      updatedAt: 1,
      due: 1,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
    };

    const archive = await buildDeckArchive(deck, [card]);
    const jsonlFile = archive.file('deck.jsonl');
    expect(jsonlFile).not.toBeNull();
    if (!jsonlFile) return;

    const imported = parseCardsFromText(await jsonlFile.async('string'));

    expect(imported[0]?.quiz).toEqual(quiz);
  });

  it('keeps legacy archives without quiz enrichment importable', () => {
    const cards = parseCardsFromText(JSON.stringify({ front: 'Legacy', back: 'Card' }));

    expect(cards).toEqual([{ front: 'Legacy', back: 'Card' }]);
  });

  it('does not re-export remote Markdown image targets in local mode', async () => {
    const deck: DeckWithStats = {
      id: 'deck-1',
      name: 'Local Markdown',
      description: 'Local content policy',
      createdAt: 1,
      updatedAt: 1,
      cardCount: 1,
      dueCount: 0,
      newCount: 1,
      learningCount: 0,
      reviewCount: 0,
      relearningCount: 0,
      retention: 1,
    };
    const card: Card = {
      id: 'card-1',
      deckId: 'deck-1',
      front: 'Read [guide](https://docs.example/guide) and ![cover](https://cdn.example/cover.png)',
      back: '<img alt="Diagram" src="http://cdn.example/diagram.png" />',
      createdAt: 1,
      updatedAt: 1,
      due: 1,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
    };

    const archive = await buildDeckArchive(deck, [card]);
    const jsonlFile = archive.file('deck.jsonl');
    expect(jsonlFile).not.toBeNull();
    if (!jsonlFile) return;

    const jsonl = await jsonlFile.async('string');
    expect(jsonl).toContain('[guide](https://docs.example/guide)');
    expect(jsonl).toContain('cover');
    expect(jsonl).toContain('Diagram');
    expect(jsonl).not.toContain('cdn.example');
  });

  it('imports image and audio entries produced by the real exporter structure', async () => {
    const imageUri = 'file:///tmp/source/card.jpg';
    const audioUri = 'file:///tmp/source/card.mp3';
    const imageFile = new File(imageUri);
    imageFile.create({ intermediates: true });
    imageFile.write('aW1hZ2U=', { encoding: 'base64' });
    const audioFile = new File(audioUri);
    audioFile.create({ intermediates: true });
    audioFile.write('YXVkaW8=', { encoding: 'base64' });

    const deck: DeckWithStats = {
      id: 'deck-1',
      name: 'Round trip',
      description: 'Local media',
      createdAt: 1,
      updatedAt: 1,
      cardCount: 1,
      dueCount: 0,
      newCount: 1,
      learningCount: 0,
      reviewCount: 0,
      relearningCount: 0,
      retention: 1,
    };
    const card: Card = {
      id: 'card-1',
      deckId: 'deck-1',
      front: 'Front',
      back: 'Back',
      imageUrl: imageUri,
      audioUrl: audioUri,
      createdAt: 1,
      updatedAt: 1,
      due: 1,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
    };

    const archive = await buildDeckArchive(deck, [card]);
    const archiveBytes = await archive.generateAsync({ type: 'arraybuffer' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(archiveBytes));

    const payload = await readImportFile({
      uri: 'file:///tmp/Round_trip.flashly',
      name: 'Round_trip.flashly',
      lastModified: 0,
      isZip: true,
    });
    const importedCards = parseCardsFromText(payload.text);

    expect(importedCards[0]?.imagePath).toMatch(/^media\/images\/.+\.jpg$/);
    expect(importedCards[0]?.audioPath).toMatch(/^media\/audio\/.+\.mp3$/);
    expect(payload.images?.[importedCards[0]?.imagePath ?? '']).toBeDefined();
    expect(payload.audio?.[importedCards[0]?.audioPath ?? '']).toBeDefined();
  });
});
