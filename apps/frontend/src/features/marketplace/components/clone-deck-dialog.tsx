/**
 * CloneDeckDialog - Confirmation dialog for cloning a deck
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { CloneDeckDialogProps } from '../types/marketplace.types';

export function CloneDeckDialog({
  deck,
  open,
  onOpenChange,
  onConfirm,
  isCloning = false,
}: CloneDeckDialogProps) {
  const { t } = useTranslation();

  if (!deck) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('decks.clone.title')}
          </DialogTitle>
          <DialogDescription>
            {t('decks.clone.description')} <strong>{deck.name}</strong>?
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>{t('decks.clone.info')}</p>
          <ul className="list-disc list-inside space-y-1">
            <li>{deck.cardCount} {t('decks.clone.cards')}</li>
            {deck.materialType && <li>{t('decks.materialType')}: {deck.materialType}</li>}
            {deck.deckType && <li>{t('decks.deckType')}: {deck.deckType}</li>}
            {deck.locale && <li>{t('decks.locale')}: {deck.locale}</li>}
          </ul>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCloning}
          >
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isCloning}>
            {isCloning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('decks.clone.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
