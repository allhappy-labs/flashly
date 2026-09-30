import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/utils/style-utils';
import type { DeckWithCardCount } from '@/types/api.types';

export interface SharedDeckCardBadge {
  key: string;
  label: string;
  className?: string;
}

export interface SharedDeckCardStat {
  key: string;
  icon: React.ReactNode;
  value: string;
  srLabel?: string;
}

export interface SharedDeckCardAction {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: React.ComponentProps<typeof Button>['variant'];
  className?: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export interface SharedDeckCardProps {
  deck: DeckWithCardCount;
  badges: SharedDeckCardBadge[];
  stats: SharedDeckCardStat[];
  featuredLabel: string;
  cardLinkTo?: string;
  headerAction?: React.ReactNode;
  primaryAction?: SharedDeckCardAction;
  secondaryAction?: SharedDeckCardAction;
  onCardClick?: () => void;
  className?: string;
}

export function SharedDeckCard(props: Readonly<SharedDeckCardProps>) {
  const interactive = Boolean(props.onCardClick) && !props.cardLinkTo;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!props.onCardClick) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    props.onCardClick();
  };

  return (
    <Card
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={props.onCardClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative gap-2 overflow-hidden border-border/70 bg-card/80 py-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg',
        interactive ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' : '',
        props.cardLinkTo ? 'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring' : '',
        props.className
      )}
    >
      {props.cardLinkTo ? (
        <Link
          to={props.cardLinkTo}
          aria-label={props.deck.name}
          className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-none"
        />
      ) : null}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/70 via-accent/80 to-chart-3/70" />
      <CardHeader className="space-y-2 px-3 pb-0 pt-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold leading-tight md:text-lg" title={props.deck.name}>
              {props.deck.name}
            </h3>
            {props.deck.description ? (
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                {props.deck.description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {props.deck.isFeatured ? (
              <Badge variant="default" className="bg-yellow-500 text-xs">
                {props.featuredLabel}
              </Badge>
            ) : null}
            {props.headerAction ? <div className="relative z-20">{props.headerAction}</div> : null}
          </div>
        </div>
        {props.badges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {props.badges.map((badge) => (
              <Badge key={badge.key} variant="outline" className={cn('border-border/70 bg-muted/50 text-xs font-medium', badge.className)}>
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="px-3 pb-1">
        <div className="grid grid-cols-3 gap-2">
          {props.stats.map((stat) => (
            <StatPill key={stat.key} icon={stat.icon} value={stat.value} srLabel={stat.srLabel} />
          ))}
        </div>
      </CardContent>
      {(props.primaryAction || props.secondaryAction) ? (
        <CardFooter className="px-3 pt-0">
          <div className="grid w-full grid-cols-1 gap-2 md:flex md:items-center md:justify-end">
            {props.primaryAction ? (
              <Button
                size="sm"
                variant={props.primaryAction.variant}
                disabled={props.primaryAction.disabled}
                className={cn('relative z-20', props.primaryAction.className)}
                onClick={props.primaryAction.onClick}
              >
                {props.primaryAction.icon}
                {props.primaryAction.label}
              </Button>
            ) : null}
            {props.secondaryAction ? (
              <Button
                size="sm"
                variant={props.secondaryAction.variant}
                disabled={props.secondaryAction.disabled}
                className={cn('relative z-20', props.secondaryAction.className)}
                onClick={props.secondaryAction.onClick}
              >
                {props.secondaryAction.icon}
                {props.secondaryAction.label}
              </Button>
            ) : null}
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function StatPill(props: { icon: React.ReactNode; value: string; srLabel?: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
      {props.icon}
      <span className="truncate">{props.value}</span>
      {props.srLabel ? <span className="sr-only">{props.srLabel}</span> : null}
    </div>
  );
}
