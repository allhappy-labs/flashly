/**
 * Types specific to the decks feature
 */

import type { DeckWithCardCount, DeckVisibility } from '@/types/api.types';

export interface DeckCardProps {
  deck: DeckWithCardCount;
  onEdit: (deck: DeckWithCardCount) => void;
  onAnalytics?: (deck: DeckWithCardCount) => void;
  onDelete: (deck: DeckWithCardCount) => void;
  onToggleVisibility: (deck: DeckWithCardCount, visibility: DeckVisibility) => void;
  isDeleting?: boolean;
  isUpdatingVisibility?: boolean;
}

export interface CreateDeckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (deck: DeckWithCardCount) => void;
}

export interface DeleteDeckDialogProps {
  deck: DeckWithCardCount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}
