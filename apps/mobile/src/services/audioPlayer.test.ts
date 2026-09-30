import { describe, expect, it, vi } from 'vitest';

const audioMocks = vi.hoisted(() => ({ createAudioPlayer: vi.fn() }));

vi.mock('expo-audio', () => ({ createAudioPlayer: audioMocks.createAudioPlayer }));

import { toggleAudioPlayback } from './audioPlayer';

describe('audio playback policy', () => {
  it('does not create a player for remote media in local mode', async () => {
    await toggleAudioPlayback('https://cdn.example/card.mp3');

    expect(audioMocks.createAudioPlayer).not.toHaveBeenCalled();
  });
});
