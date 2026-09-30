import { createAudioPlayer } from "expo-audio";
import { APP_CAPABILITIES } from "../config/app-mode";
import { usableMediaUri } from "../utils/media-policy";

type AudioPlayerInstance = ReturnType<typeof createAudioPlayer>;

let activePlayer: AudioPlayerInstance | null = null;
let activeUri: string | null = null;
let isLoading = false;
let progressInterval: ReturnType<typeof setInterval> | null = null;

type AudioPlaybackSnapshot = {
  uri: string | null;
  playing: boolean;
  progress: number;
  positionMs: number;
  durationMs: number;
};

let playbackSnapshot: AudioPlaybackSnapshot = {
  uri: null,
  playing: false,
  progress: 0,
  positionMs: 0,
  durationMs: 0,
};

const playbackListeners = new Set<(snapshot: AudioPlaybackSnapshot) => void>();

function notifyPlaybackListeners() {
  for (const listener of playbackListeners) {
    listener(playbackSnapshot);
  }
}

function updatePlaybackSnapshot(next: Partial<AudioPlaybackSnapshot>) {
  playbackSnapshot = { ...playbackSnapshot, ...next };
  notifyPlaybackListeners();
}

function clearProgressInterval() {
  if (!progressInterval) return;
  clearInterval(progressInterval);
  progressInterval = null;
}

function readPlaybackSnapshot(player: AudioPlayerInstance) {
  const positionMs = typeof player.currentTime === "number" ? player.currentTime * 1000 : 0;
  const durationMs = typeof player.duration === "number" ? player.duration * 1000 : 0;
  const progress = durationMs > 0 ? Math.min(positionMs / durationMs, 1) : 0;
  return {
    playing: Boolean(player.playing),
    positionMs,
    durationMs,
    progress,
  };
}

function unloadActive() {
  if (!activePlayer) return;
  try {
    clearProgressInterval();
    activePlayer.pause();
    activePlayer.remove();
  } catch {
    // Ignore teardown failures to avoid blocking new playback attempts.
  } finally {
    activePlayer = null;
    activeUri = null;
    updatePlaybackSnapshot({ uri: null, playing: false, progress: 0, positionMs: 0, durationMs: 0 });
  }
}

function startProgressTracking(player: AudioPlayerInstance) {
  clearProgressInterval();
  progressInterval = setInterval(() => {
    if (!activePlayer || activePlayer !== player) {
      return;
    }
    const snapshot = readPlaybackSnapshot(player);
    updatePlaybackSnapshot({
      uri: activeUri,
      ...snapshot,
    });

    if (!snapshot.playing && snapshot.durationMs > 0 && snapshot.positionMs >= snapshot.durationMs) {
      unloadActive();
    }
  }, 120);
}

export async function toggleAudioPlayback(uri?: string | null) {
  const playableUri = usableMediaUri(uri, APP_CAPABILITIES.remoteMedia);
  if (!playableUri || isLoading) return;

  if (activePlayer && activeUri === playableUri) {
    if (playbackSnapshot.playing) {
      unloadActive();
      return;
    }
    activePlayer.play();
    startProgressTracking(activePlayer);
    updatePlaybackSnapshot({ uri: playableUri, playing: true });
    return;
  }

  unloadActive();
  isLoading = true;
  try {
    const player = createAudioPlayer(playableUri, { downloadFirst: false });
    activePlayer = player;
    activeUri = playableUri;
    updatePlaybackSnapshot({ uri: playableUri, playing: true, progress: 0, positionMs: 0, durationMs: 0 });
    player.play();
    startProgressTracking(player);
  } finally {
    isLoading = false;
  }
}

export async function stopAudioPlayback() {
  unloadActive();
}

export function getAudioPlaybackSnapshot() {
  return playbackSnapshot;
}

export function subscribeToAudioPlayback(listener: (snapshot: AudioPlaybackSnapshot) => void) {
  playbackListeners.add(listener);
  listener(playbackSnapshot);
  return () => playbackListeners.delete(listener);
}
