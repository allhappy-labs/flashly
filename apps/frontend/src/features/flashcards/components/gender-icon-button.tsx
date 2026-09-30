import { cn } from '@/utils/style-utils';

type GenderIconButtonProps = {
  gender: string;
  size?: number;
  disabled?: boolean;
  className?: string;
};

function resolveGenderLetter(value: string): string {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  if (['m', 'masc', 'masculine'].includes(lower)) return 'M';
  if (['f', 'fem', 'feminine'].includes(lower)) return 'F';
  if (['n', 'neut', 'neuter', 'neutral'].includes(lower)) return 'N';
  if (['c', 'com', 'common'].includes(lower)) return 'C';

  return trimmed.slice(0, 1).toUpperCase();
}

function getGenderLabel(value: string): string {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  if (['m', 'masc', 'masculine'].includes(lower)) return 'Masculine';
  if (['f', 'fem', 'feminine'].includes(lower)) return 'Feminine';
  if (['n', 'neut', 'neuter', 'neutral'].includes(lower)) return 'Neuter';
  if (['c', 'com', 'common'].includes(lower)) return 'Common';

  return trimmed;
}

export function GenderIconButton(props: Readonly<GenderIconButtonProps>) {
  const size = props.size ?? 36;
  const innerSize = Math.max(20, size - 8);
  const letter = resolveGenderLetter(props.gender);
  const label = getGenderLabel(props.gender);

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full',
        props.disabled ? 'opacity-50' : '',
        props.className,
      )}
      style={{ width: size, height: size }}
      title={label}
      aria-label={`Gender: ${label}`}
    >
      <span className="absolute inset-0 rounded-full border shadow-sm" />
      <span
        className="relative flex items-center justify-center rounded-full bg-background"
        style={{ width: innerSize, height: innerSize }}
      >
        <span className="text-xs font-bold text-primary">{letter}</span>
      </span>
    </div>
  );
}
