import { useCallback, useEffect, useRef, useState } from 'react';

export type AudioPlaybackState = {
  activeUrl: string;
  progress: number;
  isPlaying: boolean;
};

type UseAudioPreviewPlayerResult = {
  audioState: AudioPlaybackState;
  toggleAudio: (url: string) => void;
  stopAudio: () => void;
};

export function useAudioPreviewPlayer(): UseAudioPreviewPlayerResult {
  const [audioState, setAudioState] = useState<AudioPlaybackState>({
    activeUrl: '',
    progress: 0,
    isPlaying: false,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeUrlRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const audio = new Audio();
    audio.preload = 'none';
    audioRef.current = audio;

    const updateProgress = () => {
      const activeUrl = activeUrlRef.current;
      if (!activeUrl) return;
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const progress = duration > 0 ? audio.currentTime / duration : 0;
      setAudioState({
        activeUrl,
        progress,
        isPlaying: !audio.paused,
      });
    };

    const handleEnded = () => {
      activeUrlRef.current = '';
      setAudioState({
        activeUrl: '',
        progress: 0,
        isPlaying: false,
      });
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('play', updateProgress);
    audio.addEventListener('pause', updateProgress);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleEnded);

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', updateProgress);
      audio.removeEventListener('play', updateProgress);
      audio.removeEventListener('pause', updateProgress);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleEnded);
    };
  }, []);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    activeUrlRef.current = '';
    setAudioState({
      activeUrl: '',
      progress: 0,
      isPlaying: false,
    });
  }, []);

  const toggleAudio = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      const audio = audioRef.current;
      if (!audio) return;

      const isSame = activeUrlRef.current === trimmed;
      if (isSame && !audio.paused) {
        stopAudio();
        return;
      }

      activeUrlRef.current = trimmed;
      audio.pause();
      audio.currentTime = 0;
      if (audio.src !== trimmed) {
        audio.src = trimmed;
      }

      const maybePromise = audio.play();
      setAudioState({
        activeUrl: trimmed,
        progress: 0,
        isPlaying: true,
      });

      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {
          stopAudio();
        });
      }
    },
    [stopAudio],
  );

  return { audioState, toggleAudio, stopAudio };
}
