/**
 * DeckGrid - Responsive grid layout for displaying decks
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';
import { DeckCard } from './deck-card';
import type { DeckWithCardCount, DeckVisibility } from '@/types/api.types';

export interface DeckGridProps {
  decks: DeckWithCardCount[];
  isLoading?: boolean;
  onEdit: (deck: DeckWithCardCount) => void;
  onAnalytics?: (deck: DeckWithCardCount) => void;
  onDelete: (deck: DeckWithCardCount) => void;
  onToggleVisibility: (deck: DeckWithCardCount, visibility: DeckVisibility) => void;
  deletingDeckId?: string;
  updatingVisibilityDeckId?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DeckGrid({
  decks,
  isLoading = false,
  onEdit,
  onAnalytics,
  onDelete,
  onToggleVisibility,
  deletingDeckId,
  updatingVisibilityDeckId,
  emptyTitle,
  emptyDescription,
}: DeckGridProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-40 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-6xl mb-4">📚</div>
        <h3 className="text-lg font-semibold mb-2">
          {emptyTitle || t('decks.empty.title')}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {emptyDescription || t('decks.empty.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {decks.map((deck) => (
        <DeckCard
          key={deck.id}
          deck={deck}
          onEdit={onEdit}
          onAnalytics={onAnalytics}
          onDelete={onDelete}
          onToggleVisibility={onToggleVisibility}
          isDeleting={deletingDeckId === deck.id}
          isUpdatingVisibility={updatingVisibilityDeckId === deck.id}
        />
      ))}
    </div>
  );
}
