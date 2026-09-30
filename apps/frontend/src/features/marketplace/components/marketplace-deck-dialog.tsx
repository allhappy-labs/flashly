import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Eye, Layers, Plus, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getFlagEmoji } from '@/components/ui/language-combobox';
import type { Card, DeckWithCardCount, DeckWithCards } from '@/types/api.types';
import { ELEVENLABS_V3_LANGUAGES } from '@flashly/shared/src';

export interface MarketplaceDeckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckSummary: DeckWithCardCount | null;
  deckDetails: DeckWithCards | null;
  isLoading?: boolean;
  error?: Error | null;
  onClone: (deck: DeckWithCardCount) => void;
  onNominate?: (deck: DeckWithCardCount) => void;
  isCloning?: boolean;
}

export function MarketplaceDeckDialog({
  open,
  onOpenChange,
  deckSummary,
  deckDetails,
  isLoading = false,
  error,
  onClone,
  onNominate,
  isCloning = false,
}: MarketplaceDeckDialogProps) {
  const { t } = useTranslation();

  const deck = deckDetails ?? deckSummary;
  const cardCount = deckSummary?.cardCount ?? deckDetails?.cards.length ?? 0;
  const actionableDeck = React.useMemo<DeckWithCardCount | null>(() => {
    if (deckSummary) return deckSummary;
    if (!deckDetails) return null;
    return {
      ...deckDetails,
      cardCount: deckDetails.cards.length,
    };
  }, [deckSummary, deckDetails]);
  const cards = deckDetails?.cards ?? [];
  const previewCards = cards.slice(0, 8);
  const languageLabel = React.useMemo(() => {
    if (!deck?.locale) return null;
    return ELEVENLABS_V3_LANGUAGES.find((language) => language.code === deck.locale)?.name ?? deck.locale.toUpperCase();
  }, [deck?.locale]);

  if (!deck) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="pr-8 text-xl">{deck.name}</DialogTitle>
          <DialogDescription>
            {deck.description || t('decks.marketplaceDescription')}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message || t('marketplace.loadDetailsError')}
          </p>
        )}

        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-2">
            {deck.materialType && (
              <Badge variant="outline">{deck.materialType}</Badge>
            )}
            {deck.deckType && (
              <Badge variant="outline">{deck.deckType}</Badge>
            )}
            {languageLabel && (
              <Badge variant="outline">
                {deck.locale ? `${getFlagEmoji(deck.locale)} ${languageLabel}` : languageLabel}
              </Badge>
            )}
            {deck.marketplaceMetadata?.level && (
              <Badge variant="outline">{deck.marketplaceMetadata.level}</Badge>
            )}
            {deck.marketplaceMetadata?.regionalVariant && (
              <Badge variant="outline">{deck.marketplaceMetadata.regionalVariant}</Badge>
            )}
            {deck.marketplaceMetadata?.script && (
              <Badge variant="outline">{deck.marketplaceMetadata.script}</Badge>
            )}
            {deck.marketplaceMetadata?.license?.name && (
              <Badge variant="outline">{deck.marketplaceMetadata.license.name}</Badge>
            )}
            {deck.isFeatured && (
              <Badge className="bg-yellow-500 text-primary-foreground">
                <Star className="mr-1 h-3 w-3" />
                {t('web.decks.featured.label')}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              icon={<Layers className="h-4 w-4" />}
              label={t('marketplace.cardsLabel')}
              value={cardCount.toString()}
            />
            <StatCard
              icon={<Download className="h-4 w-4" />}
              label={t('marketplace.downloadsLabel')}
              value={deck.downloadCount.toString()}
            />
            <StatCard
              icon={<Eye className="h-4 w-4" />}
              label={t('marketplace.viewsLabel')}
              value={deck.viewCount.toString()}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => actionableDeck && onClone(actionableDeck)} disabled={isCloning || !actionableDeck}>
              <Plus className="mr-1.5 h-4 w-4" />
              {isCloning ? t('marketplace.addingToLibrary') : t('marketplace.addAction')}
            </Button>
            {onNominate && actionableDeck && (
              <Button variant="outline" onClick={() => onNominate(actionableDeck)}>
                <Star className="mr-2 h-4 w-4 text-yellow-500" />
                {t('nominations.nominate')}
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">
              {t('marketplace.cardPreview', { count: cardCount })}
            </h3>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={`preview-skeleton-${index}`} className="h-28 w-full rounded-lg" />
                ))}
              </div>
            ) : previewCards.length === 0 ? (
              <p className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                {t('decks.cardsPlaceholder')}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {previewCards.map((card) => (
                  <CardPreview key={card.id} card={card} />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard(props: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <p className="mb-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        {props.icon}
        {props.label}
      </p>
      <p className="text-lg font-semibold">{props.value}</p>
    </div>
  );
}

function CardPreview(props: { card: Card }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border/70 bg-card/70 p-3">
      <p className="text-xs font-semibold text-muted-foreground">{t('decks.cards.front')}</p>
      <p className="line-clamp-2 text-sm">{props.card.front}</p>
      <p className="mt-3 text-xs font-semibold text-muted-foreground">{t('decks.cards.back')}</p>
      <p className="line-clamp-3 text-sm">{props.card.back}</p>
    </div>
  );
}
