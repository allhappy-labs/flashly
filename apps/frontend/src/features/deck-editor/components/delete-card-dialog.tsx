/**
 * DeleteCardDialog - Confirmation dialog for deleting a card
 */

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
import type { Card } from '@/types/api.types';

export interface DeleteCardDialogProps {
  card: Card | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteCardDialog({
  card,
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: DeleteCardDialogProps) {
  const { t } = useTranslation();

  if (!card) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('decks.cards.delete.title')}
          </DialogTitle>
          <DialogDescription>
            {t('decks.cards.delete.description')} <strong>"{card.front}"</strong>?
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {t('decks.cards.delete.warning')}
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
            {t('decks.cards.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
