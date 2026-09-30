/**
 * Deck Editor Page - Edit deck metadata and cards
 */

import * as React from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CheckSquare, Wand2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DeckMetadataForm } from '@/features/deck-editor/components/deck-metadata-form';
import { UnsavedChangesBanner } from '@/features/deck-editor/components/unsaved-changes-banner';
import { CardListBatch } from '@/features/deck-editor/components/card-list-batch';
import { AddCardDialog } from '@/features/deck-editor/components/add-card-dialog';
import { EditCardDialog } from '@/features/deck-editor/components/edit-card-dialog';
import { DeleteCardDialog } from '@/features/deck-editor/components/delete-card-dialog';
import { BulkActionBar } from '@/features/deck-editor/components/bulk-action-bar';
import { BulkDeleteDialog } from '@/features/deck-editor/components/bulk-delete-dialog';
import { useDeckWithCards } from '@/features/deck-editor/hooks/use-deck-with-cards';
import { useUpdateDeck } from '@/features/decks/hooks/use-update-deck';
import { useUnsavedChanges } from '@/features/deck-editor/hooks/use-unsaved-changes';
import { useCreateCard } from '@/features/deck-editor/hooks/use-create-card';
import { useUpdateCard } from '@/features/deck-editor/hooks/use-update-card';
import { useDeleteCard } from '@/features/deck-editor/hooks/use-delete-card';
import { useBulkDeleteCards, useBulkUpdateCards } from '@/features/deck-editor/hooks/use-bulk-card-operations';
import { collectCardFieldSuggestions } from '@/features/deck-editor/utils/card-field-suggestions';
import type { Card, CreateCardInput, UpdateDeckInput } from '@/types/api.types';

export function DeckEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const deckId = typeof params.id === 'string' ? params.id : null;

    const {
        data: deckWithCards,
        error,
        isLoading,
        refetch,
    } = useDeckWithCards(deckId ?? '', {
    executeOnMount: Boolean(deckId),
  });
  const { mutate: updateDeck, isLoading: isSaving } = useUpdateDeck({
    onSuccess: () => {
      toast.success(t('decks.update.success'));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || t('decks.update.error'));
    },
  });

  const { mutate: createCardMutation, isLoading: isAddingCard } = useCreateCard({
    onSuccess: () => {
      toast.success(t('decks.cards.addResult.success'));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || t('decks.cards.addResult.error'));
    },
  });

  const { mutate: updateCardMutation, isLoading: isUpdatingCard } = useUpdateCard({
    onSuccess: () => {
      toast.success(t('decks.cards.update.success'));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || t('decks.cards.update.error'));
    },
  });

  const { mutate: deleteCardMutation, isLoading: isDeletingCard } = useDeleteCard({
    onSuccess: () => {
      toast.success(t('decks.cards.delete.success'));
      setDeleteCardDialogOpen(false);
      setDeleteCard(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || t('decks.cards.delete.error'));
    },
  });

  // Bulk operations
  const { mutate: bulkDeleteMutation, isLoading: isBulkDeleting } = useBulkDeleteCards({
    onSuccess: (data) => {
      toast.success(t('decks.cards.bulk.delete.success', { count: data.count }));
      setBulkDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setSelectionMode(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || t('decks.cards.bulk.delete.error'));
    },
  });

  const { mutate: bulkUpdateMutation, isLoading: isBulkUpdating } = useBulkUpdateCards({
    onSuccess: (data) => {
      toast.success(t('decks.cards.bulk.updateResult.success', { count: data.count }));
      setSelectedIds(new Set());
      setSelectionMode(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || t('decks.cards.bulk.updateResult.error'));
    },
  });

  React.useEffect(() => {
    if (!deckId) {
      navigate({ to: '/my-decks' });
    }
  }, [deckId, navigate]);

  // Track current form values
  const [currentValues, setCurrentValues] = React.useState<UpdateDeckInput>({});
  const { hasChanges } = useUnsavedChanges(deckWithCards, currentValues, {
    onBeforeUnload: true,
  });

  // Card editing state
  const [editCard, setEditCard] = React.useState<Card | null>(null);
  const [editCardDialogOpen, setEditCardDialogOpen] = React.useState(false);
  const [deleteCard, setDeleteCard] = React.useState<Card | null>(null);
  const [deleteCardDialogOpen, setDeleteCardDialogOpen] = React.useState(false);

  // Batch mode state
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const fieldSuggestions = React.useMemo(
    () => collectCardFieldSuggestions(deckWithCards?.cards ?? []),
    [deckWithCards?.cards],
  );

  if (!deckId) {
    return null;
  }

  const handleUpdateMetadata = (updates: UpdateDeckInput) => {
    setCurrentValues(updates);
  };

  const handleSave = () => {
    if (Object.keys(currentValues).length > 0) {
      updateDeck({ deckId, input: currentValues });
    }
  };

  const handleDiscard = () => {
    setCurrentValues({});
    refetch();
  };

  const handleAddCard = (input: Omit<CreateCardInput, 'deckId'>) => {
    createCardMutation({ deckId, input });
  };

  const handleEditCard = (card: Card) => {
    setEditCard(card);
    setEditCardDialogOpen(true);
  };

  const handleUpdateCard = (input: Parameters<typeof updateCardMutation>[0]['input']) => {
    if (!editCard) return;
    updateCardMutation({ deckId, cardId: editCard.id, input });
    setEditCardDialogOpen(false);
  };

  const handleDeleteCardClick = (card: Card) => {
    setDeleteCard(card);
    setDeleteCardDialogOpen(true);
  };

  const handleDeleteCardConfirm = () => {
    if (deleteCard) {
      deleteCardMutation({ deckId, cardId: deleteCard.id });
    }
  };

  // Batch operation handlers
  const handleToggleSelection = (cardId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const handleToggleSelectAll = () => {
    if (!deckWithCards) return;
    const allIds = new Set(deckWithCards.cards.map((c) => c.id));

    if (selectedIds.size === allIds.size) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(allIds);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = () => {
    bulkDeleteMutation({ deckId, cardIds: Array.from(selectedIds) });
  };

  const handleBulkUpdate = (updates: { category?: string; tags?: string }) => {
    if (selectedIds.size === 0) return;
    bulkUpdateMutation({ deckId, cardIds: Array.from(selectedIds), updates });
  };

  const handleToggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedIds(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const isAllSelected = deckWithCards ? selectedIds.size === deckWithCards.cards.length : false;

  if (error) {
    return (
      <div className="space-y-8">
        <div className="text-destructive">{error.message}</div>
      </div>
    );
  }

  if (isLoading || !deckWithCards) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-5/6" />
          </div>
          <div className="lg:col-span-2 space-y-3">
            <div className="h-32 bg-muted rounded animate-pulse" />
            <div className="h-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Metadata (1/3) */}
          <div className="lg:col-span-1 space-y-6">
            <UnsavedChangesBanner
              hasChanges={hasChanges}
              onDiscard={handleDiscard}
              onSave={handleSave}
              isSaving={isSaving}
            />

            <DeckMetadataForm
              deck={deckWithCards}
              onUpdate={handleUpdateMetadata}
              onSave={handleSave}
              isSaving={isSaving}
              hasChanges={hasChanges}
            />
          </div>

          {/* Right Column - Cards (2/3) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <h2 className="text-lg font-semibold">{t('decks.cards.title')}</h2>
                <Badge variant="secondary">{deckWithCards.cards.length}</Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={selectionMode ? 'default' : 'outline'}
                      size="icon"
                      onClick={handleToggleSelectionMode}
                      aria-label={
                                                selectionMode
                                                    ? t('decks.cards.bulk.exit')
                                                    : t('decks.cards.bulk.select')
                      }
                    >
                      {selectionMode ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <CheckSquare className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {selectionMode ? t('decks.cards.bulk.exit') : t('decks.cards.bulk.select')}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        navigate({
                                            to: '/generate',
                                            search:
                                                selectedIds.size > 0
                                                    ? {
                                                          quizDeckId: deckId,
                                                          quizCardIds: Array.from(selectedIds).join(','),
                                                      }
                                                    : { quizDeckId: deckId },
                                        })
                                    }
                                >
                                    <Wand2 className="mr-2 h-4 w-4" />
                                    {t('decks.cards.generateQuiz')}
                                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate({
                      to: '/generate',
                      search: {
                        appendDeckId: deckId,
                      },
                    })
                  }
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  {t('decks.cards.generateMore')}
                </Button>
                <AddCardDialog
                  deckId={deckId}
                  onAdd={handleAddCard}
                  isAdding={isAddingCard}
                  fieldSuggestions={fieldSuggestions}
                />
              </div>
            </div>

            <CardListBatch
              cards={deckWithCards.cards}
              onEdit={handleEditCard}
              onDelete={handleDeleteCardClick}
              deletingCardId={isDeletingCard ? deleteCard?.id : undefined}
              isLoading={isLoading}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelection={handleToggleSelection}
              onToggleSelectAll={handleToggleSelectAll}
              isAllSelected={isAllSelected}
            />

            <EditCardDialog
              card={editCard}
              open={editCardDialogOpen}
              onOpenChange={setEditCardDialogOpen}
              onUpdate={handleUpdateCard}
              isUpdating={isUpdatingCard}
              fieldSuggestions={fieldSuggestions}
            />

            <DeleteCardDialog
              card={deleteCard}
              open={deleteCardDialogOpen}
              onOpenChange={setDeleteCardDialogOpen}
              onConfirm={handleDeleteCardConfirm}
              isDeleting={isDeletingCard}
            />

            {/* Bulk Action Bar */}
            {selectionMode && selectedIds.size > 0 && (
              <BulkActionBar
                selectedCount={selectedIds.size}
                onDelete={handleBulkDelete}
                onUpdateCategory={(category) => handleBulkUpdate({ category })}
                onUpdateTags={(tags) => handleBulkUpdate({ tags })}
                onClearSelection={handleClearSelection}
                isDeleting={isBulkDeleting}
                isUpdating={isBulkUpdating}
                fieldSuggestions={fieldSuggestions}
              />
            )}

            {/* Bulk Delete Dialog */}
            <BulkDeleteDialog
              open={bulkDeleteDialogOpen}
              onOpenChange={setBulkDeleteDialogOpen}
              onConfirm={handleBulkDeleteConfirm}
              count={selectedIds.size}
              isDeleting={isBulkDeleting}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
