import { useMemo } from 'react';
import { Play, Square } from 'lucide-react';
import { cn } from '@/utils/style-utils';

type AudioProgressButtonProps = {
  isPlaying: boolean;
  progress: number;
  onClick: () => void;
  labelPlay: string;
  labelStop: string;
  size?: number;
  disabled?: boolean;
  className?: string;
};

export function AudioProgressButton(props: Readonly<AudioProgressButtonProps>) {
  const size = props.size ?? 36;
  const progress = Math.min(1, Math.max(0, props.progress));
  const progressPercent = Math.round(progress * 100);
  const ringStyle = useMemo(
    () => ({
      background: `conic-gradient(hsl(var(--primary)) ${progressPercent}%, hsl(var(--border)) 0%)`,
    }),
    [progressPercent],
  );

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.isPlaying ? props.labelStop : props.labelPlay}
      aria-pressed={props.isPlaying}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full transition-opacity',
        props.disabled ? 'opacity-50' : 'hover:opacity-90',
        props.className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-full" style={ringStyle} />
      <span
        className="relative flex items-center justify-center rounded-full bg-background shadow-sm"
        style={{ width: size, height: size }}
      >
        {props.isPlaying ? (
          <Square className="h-4 w-4 text-foreground" />
        ) : (
          <Play className="h-4 w-4 text-foreground" />
        )}
      </span>
    </button>
  );
}
