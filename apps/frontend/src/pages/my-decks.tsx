/**
 * My Decks Page - Browse and manage user's own decks
 */

import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Download, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DeckGrid } from '@/features/decks/components/deck-grid';
import { CreateDeckDialog } from '@/features/decks/components/create-deck-dialog';
import { DeleteDeckDialog } from '@/features/decks/components/delete-deck-dialog';
import { DeckImportDialog } from '@/features/decks/components/deck-import-dialog';
import { useDecks } from '@/features/decks/hooks/use-decks';
import { useDeleteDeck } from '@/features/decks/hooks/use-delete-deck';
import { useUpdateDeck } from '@/features/decks/hooks/use-update-deck';
import type { DeckWithCardCount, DeckVisibility } from '@/types/api.types';

export function MyDecks() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, error, isLoading, refetch } = useDecks({ page: 1, limit: 50 });

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [deleteDeck, setDeleteDeck] = React.useState<DeckWithCardCount | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);

  // Mutation hooks
  const { mutate: deleteDeckMutation, isLoading: isDeleting } = useDeleteDeck({
    onSuccess: () => {
      toast.success(t('decks.delete.success'));
      setDeleteDialogOpen(false);
      setDeleteDeck(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || t('decks.delete.error'));
    },
  });

  const { mutate: updateVisibilityMutation, isLoading: isUpdatingVisibility } =
    useUpdateDeck({
      onSuccess: () => {
        toast.success(t('decks.visibility.success'));
        refetch();
      },
      onError: (error) => {
        toast.error(error.message || t('decks.visibility.error'));
      },
    });

  // Handlers
  const handleEdit = (deck: DeckWithCardCount) => {
    navigate({ to: `/deck-editor/${deck.id}` });
  };

  const handleDeleteClick = (deck: DeckWithCardCount) => {
    setDeleteDeck(deck);
    setDeleteDialogOpen(true);
  };

  const handleOpenAnalytics = (deck: DeckWithCardCount) => {
    navigate({ to: `/my-decks/${deck.id}/analytics` });
  };

  const handleDeleteConfirm = () => {
    if (deleteDeck) {
      deleteDeckMutation(deleteDeck.id);
    }
  };

  const handleToggleVisibility = (deck: DeckWithCardCount, visibility: DeckVisibility) => {
    updateVisibilityMutation({ deckId: deck.id, input: { visibility } });
  };

  const handleCreateSuccess = (deck: DeckWithCardCount) => {
    toast.success(t('decks.create.success'));
    navigate({ to: `/deck-editor/${deck.id}` });
    refetch();
  };

  const handleImportSuccess = (deckId: string) => {
    refetch();
    navigate({ to: `/deck-editor/${deckId}` });
  };

  if (error) {
    return (
      <div className="space-y-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t('decks.myDecks')}</h1>
        </div>
        <div className="text-destructive">{error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('decks.myDecks')}</h1>
          <p className="text-muted-foreground mt-1">{t('decks.myDecksDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            {t('decks.import.title')}
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('decks.create.new')}
          </Button>
        </div>
      </div>

      <DeckGrid
        decks={data?.items ?? []}
        isLoading={isLoading}
        onEdit={handleEdit}
        onAnalytics={handleOpenAnalytics}
        onDelete={handleDeleteClick}
        onToggleVisibility={handleToggleVisibility}
        deletingDeckId={isDeleting ? deleteDeck?.id : undefined}
        updatingVisibilityDeckId={isUpdatingVisibility ? undefined : undefined}
      />

      <CreateDeckDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      <DeleteDeckDialog
        deck={deleteDeck}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      <DeckImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}
