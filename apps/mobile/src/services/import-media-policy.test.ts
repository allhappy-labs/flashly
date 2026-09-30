import { describe, expect, it } from 'vitest';
import { sanitizeImportedCardMedia } from './import-media-policy';

describe('sanitizeImportedCardMedia', () => {
  it('clears HTTP media before local import persistence', () => {
    expect(
      sanitizeImportedCardMedia(
        {
          front: 'Question ![remote](https://cdn.example/front.png)',
          back: '<img alt="Answer image" src="https://cdn.example/back.png" />',
          imageUrl: 'https://cdn.example/card.jpg',
          audioUrl: 'http://cdn.example/card.mp3',
        },
        false,
      ),
    ).toEqual({
      front: 'Question remote',
      back: 'Answer image',
      imageUrl: undefined,
      audioUrl: undefined,
    });
  });

  it('preserves remote media for hosted imports', () => {
    expect(
      sanitizeImportedCardMedia(
        {
          front: 'Question ![remote](https://cdn.example/front.png)',
          back: '<img alt="Answer image" src="https://cdn.example/back.png" />',
          imageUrl: 'https://cdn.example/card.jpg',
          audioUrl: 'http://cdn.example/card.mp3',
        },
        true,
      ),
    ).toEqual({
      front: 'Question ![remote](https://cdn.example/front.png)',
      back: '<img alt="Answer image" src="https://cdn.example/back.png" />',
      imageUrl: 'https://cdn.example/card.jpg',
      audioUrl: 'http://cdn.example/card.mp3',
    });
  });
});
