/**
 * Types specific to the deck editor feature
 */

import type { Card, Deck, UpdateDeckInput } from '@/types/api.types';

export interface DeckMetadataFormProps {
  deck: Deck;
  onUpdate: (updates: UpdateDeckInput) => void;
  onSave: () => void;
  isSaving?: boolean;
  hasChanges?: boolean;
  disabled?: boolean;
}

export interface EditorLayoutProps {
  deckId: string;
  children: React.ReactNode;
}

export interface UnsavedChangesBannerProps {
  hasChanges: boolean;
  onDiscard: () => void;
  onSave: () => void;
  isSaving?: boolean;
}

export interface CardListItemProps {
  card: Card;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
  isDeleting?: boolean;
}
