import { describe, expect, it } from 'vitest';
import { isRemoteMediaUri, usableMediaUri } from './media-policy';

describe('media policy', () => {
  it('identifies HTTP media', () => {
    expect(isRemoteMediaUri('https://cdn.example/card.jpg')).toBe(true);
    expect(isRemoteMediaUri('http://cdn.example/audio.mp3')).toBe(true);
    expect(isRemoteMediaUri('file:///data/card.jpg')).toBe(false);
  });

  it('clears remote media locally and preserves local media', () => {
    expect(usableMediaUri('https://cdn.example/card.jpg', false)).toBeNull();
    expect(usableMediaUri('file:///data/card.jpg', false)).toBe('file:///data/card.jpg');
  });

  it('preserves remote media in hosted mode', () => {
    expect(usableMediaUri('https://cdn.example/card.jpg', true)).toBe(
      'https://cdn.example/card.jpg',
    );
  });
});
