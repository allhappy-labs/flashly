/**
 * DeckCard - Reusable card component for displaying deck information
 */

import * as React from 'react';
import { MoreVertical, Eye, EyeOff, Trash2, Edit, Layers, Download, Smartphone, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { DeckTransferFormatId } from '@flashly/shared';

import { Button } from '@/components/ui/button';
import { SharedDeckCard } from '@/components/decks/shared-deck-card';
import { getFlagEmoji } from '@/components/ui/language-combobox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DeckCardProps } from '../types/deck.types';
import { ELEVENLABS_V3_LANGUAGES } from '@flashly/shared/src';
import { getDeck } from '@/lib/api/deck-service';
import { downloadDeckAsFlashly } from '@/services/deck-download-service';
import { openNativeDeckLearning } from '../utils/native-learning';
import { useDeckTransfer } from '../hooks/use-deck-transfer';

export function DeckCard({
  deck,
  onEdit,
  onAnalytics,
  onDelete,
  onToggleVisibility,
  isDeleting = false,
  isUpdatingVisibility = false,
}: DeckCardProps) {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = React.useState(false);
  const { exportDeck, isExporting } = useDeckTransfer();
  const isLanguageDeck = deck.materialType === 'Language';
  const languageLabel = React.useMemo(() => {
    if (!deck.locale) return null;
    return ELEVENLABS_V3_LANGUAGES.find((language) => language.code === deck.locale)?.name ?? deck.locale.toUpperCase();
  }, [deck.locale]);
  const languageFlag = deck.locale ? getFlagEmoji(deck.locale) : null;
  const showLanguageBadge = isLanguageDeck && Boolean(deck.locale && languageLabel);

  const badges = React.useMemo(() => {
    const next = [];
    if (deck.materialType) {
      next.push({
        key: 'material',
        label: deck.materialType,
      });
    }
    if (deck.deckType) {
      next.push({
        key: 'deckType',
        label: deck.deckType,
      });
    }
    if (showLanguageBadge && languageLabel) {
      next.push({
        key: 'language',
        label: languageFlag ? `${languageFlag} ${languageLabel}` : languageLabel,
      });
    }
    if (deck.visibility === 'public') {
      next.push({
        key: 'visibility',
        label: t('decks.public'),
        className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      });
    }
    return next;
  }, [deck.deckType, deck.materialType, deck.visibility, languageFlag, languageLabel, showLanguageBadge, t]);

  const handleDownloadDeck = React.useCallback(async () => {
    if (isDownloading) {
      return;
    }

    setIsDownloading(true);
    try {
      const result = await getDeck(deck.id);
      const deckWithCards = result.match(
        (value) => value,
        (error) => {
          throw new Error(error.message || t('web.flashcards.downloadFailed'));
        }
      );

      await downloadDeckAsFlashly({
        deckName: deckWithCards.name,
        cards: deckWithCards.cards,
        locale: deckWithCards.locale,
        description: deckWithCards.description,
        materialType: deckWithCards.materialType,
        deckType: deckWithCards.deckType,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('web.flashcards.downloadFailed');
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  }, [deck.id, isDownloading, t]);

  const handleOpenNativeLearning = React.useCallback(() => {
    toast.info(t('decks.learnInApp.openingToast'));
    openNativeDeckLearning(deck.id);
  }, [deck.id, t]);

  const handleExternalExport = React.useCallback(
    async (formatId: DeckTransferFormatId) => {
      if (isExporting) {
        return;
      }

      const result = await exportDeck({
        formatId,
        deckId: deck.id,
      });

      if (!result.success) {
        toast.error(result.error.message || t('decks.transfer.export.error'));
        return;
      }

      const extension = formatId === 'anki-csv' ? 'anki.csv' : 'quizlet.txt';
      const mimeType = formatId === 'anki-csv' ? 'text/csv' : 'text/plain';
      const blob = new Blob([result.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizeFileName(deck.name)}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(t('decks.transfer.export.success'));
    },
    [deck.id, deck.name, exportDeck, isExporting, t],
  );

  const headerAction = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={isDeleting || isUpdatingVisibility}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">{t('decks.options')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onClick={() => onEdit(deck)}>
          <Edit className="mr-2 h-4 w-4" />
          {t('decks.edit')}
        </DropdownMenuItem>
        {onAnalytics ? (
          <DropdownMenuItem onClick={() => onAnalytics(deck)}>
            <BarChart3 className="mr-2 h-4 w-4" />
            {t('analytics.title')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onClick={() =>
            onToggleVisibility(deck, deck.visibility === 'public' ? 'private' : 'public')
          }
          disabled={isUpdatingVisibility}
        >
          {deck.visibility === 'public' ? (
            <>
              <EyeOff className="mr-2 h-4 w-4" />
              {t('decks.makePrivate')}
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" />
              {t('decks.makePublic')}
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDownloadDeck} disabled={isDownloading}>
          <Download className="mr-2 h-4 w-4" />
          {t('web.flashcards.downloadZip')}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {t('decks.transfer.export.format')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleExternalExport('anki-csv')} disabled={isExporting}>
              {t('decks.transfer.formats.ankiCsv')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExternalExport('quizlet-txt')} disabled={isExporting}>
              {t('decks.transfer.formats.quizletTxt')}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(deck)}
          disabled={isDeleting}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('common.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <SharedDeckCard
      deck={deck}
      cardLinkTo={`/deck-editor/${deck.id}`}
      featuredLabel={t('web.decks.featured.label')}
      headerAction={headerAction}
      badges={badges}
      stats={[
        {
          key: 'cards',
          icon: <Layers className="h-3.5 w-3.5" />,
          value: t('deckList.cardCount', { count: deck.cardCount }),
        },
        {
          key: 'downloads',
          icon: <Download className="h-3.5 w-3.5" />,
          value: String(deck.downloadCount),
          srLabel: t('decks.users.stats.downloads'),
        },
        {
          key: 'views',
          icon: <Eye className="h-3.5 w-3.5" />,
          value: String(deck.viewCount),
          srLabel: t('decks.view'),
        },
      ]}
      primaryAction={{
        label: t('deck.study'),
        icon: <Smartphone className="mr-1.5 h-4 w-4" />,
        variant: 'outline',
        onClick: (event) => {
          event.stopPropagation();
          handleOpenNativeLearning();
        },
      }}
    />
  );
}

function sanitizeFileName(value: string): string {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const safe = normalized
    .replace(/[^a-z0-9\-_]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || 'deck';
}
