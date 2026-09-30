import type * as React from 'react';
import { BookOpen, HelpCircle, Highlighter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/style-utils';
import type { FlashcardFormat } from '@flashly/shared/src';

const FORMAT_DESCRIPTIONS: Record<FlashcardFormat, string> = {
  QA: 'web.flashcards.format.qaDescription',
  Cloze: 'web.flashcards.format.clozeDescription',
  Definition: 'web.flashcards.format.definitionDescription',
};

const FORMAT_OPTIONS: Array<{
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  value: FlashcardFormat;
}> = [
  { icon: HelpCircle, labelKey: 'web.flashcards.format.qaLabel', value: 'QA' },
  { icon: Highlighter, labelKey: 'web.flashcards.format.clozeLabel', value: 'Cloze' },
  { icon: BookOpen, labelKey: 'web.flashcards.format.definitionLabel', value: 'Definition' },
];

type FlashcardFormatSelectorProps = Readonly<{
  value: FlashcardFormat;
  onChange: (value: FlashcardFormat) => void;
  disabled?: boolean;
  size?: 'default' | 'compact';
  showDescription?: boolean;
}> &
  Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>;

export function FlashcardFormatSelector({
  value,
  onChange,
  disabled = false,
  size = 'default',
  showDescription = true,
  className,
  ...rest
}: FlashcardFormatSelectorProps) {
  const { t } = useTranslation();
  const buttonSize = size === 'compact' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm';
  const iconWrapSize = size === 'compact' ? 'h-7 w-7' : 'h-8 w-8';
  const iconSize = size === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const gridLayout = size === 'compact' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3';

  return (
    <div className={cn('space-y-2', className)} {...rest}>
      <div className={cn('grid gap-2', gridLayout)}>
        {FORMAT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'group flex min-w-0 items-center gap-2 rounded-lg border text-left transition',
                buttonSize,
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-primary-soft hover:text-primary-foreground',
                disabled && 'cursor-not-allowed opacity-50 hover:bg-background',
              )}
              aria-pressed={isSelected}
              disabled={disabled}
            >
              <span
                className={cn(
                  'shrink-0 flex items-center justify-center rounded-md',
                  iconWrapSize,
                  isSelected
                    ? 'bg-primary-foreground/15 text-primary-foreground'
                    : 'bg-muted text-muted-foreground group-hover:bg-primary-foreground/15 group-hover:text-primary-foreground',
                )}
              >
                <Icon className={cn(iconSize, 'shrink-0')} />
              </span>
              <span className="min-w-0 truncate font-medium">{t(option.labelKey)}</span>
            </button>
          );
        })}
      </div>
      {showDescription && (
        <p className="text-xs text-muted-foreground">
          {FORMAT_DESCRIPTIONS[value] ? t(FORMAT_DESCRIPTIONS[value]) : ''}
        </p>
      )}
    </div>
  );
}
