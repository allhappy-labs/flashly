/**
 * DeleteDeckDialog - Confirmation dialog for deleting a deck
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

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
import type { DeleteDeckDialogProps } from '../types/deck.types';

export function DeleteDeckDialog({
  deck,
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: DeleteDeckDialogProps) {
  const { t } = useTranslation();

  if (!deck) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('decks.delete.title')}
          </DialogTitle>
          <DialogDescription>
            {t('decks.delete.description')} <strong>{deck.name}</strong>?
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {t('decks.delete.warning')}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('decks.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
