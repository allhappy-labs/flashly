/**
 * MarketplaceCard - Card component for displaying public decks in marketplace
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Eye, Layers, Plus, Star } from 'lucide-react';

import { SharedDeckCard } from '@/components/decks/shared-deck-card';
import { getFlagEmoji } from '@/components/ui/language-combobox';
import type { MarketplaceCardProps } from '../types/marketplace.types';
import {
  ELEVENLABS_V3_LANGUAGES,
  FLASHCARD_FORMATS,
  FLASHCARD_MATERIAL_TYPES,
  FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS,
  type FlashcardFormat,
  type FlashcardMaterialType,
} from '@flashly/shared/src';

const FLASHCARD_FORMAT_LABEL_KEYS: Record<FlashcardFormat, string> = {
  QA: 'web.flashcards.format.qaLabel',
  Cloze: 'web.flashcards.format.clozeLabel',
  Definition: 'web.flashcards.format.definitionLabel',
};

export function MarketplaceCard({
  deck,
  onView,
  onClone,
  onNominate,
  isCloning = false,
}: MarketplaceCardProps) {
  const { t } = useTranslation();

  const languageLabel = React.useMemo(() => {
    if (!deck.locale) return null;
    return ELEVENLABS_V3_LANGUAGES.find((language) => language.code === deck.locale)?.name ?? deck.locale.toUpperCase();
  }, [deck.locale]);
  const languageFlag = deck.locale ? getFlagEmoji(deck.locale) : null;
  const materialTypeLabel = React.useMemo(() => {
    if (!deck.materialType) return null;
    if (!FLASHCARD_MATERIAL_TYPES.includes(deck.materialType as FlashcardMaterialType)) {
      return deck.materialType;
    }
    const materialType = deck.materialType as FlashcardMaterialType;
    return t(`web.flashcards.material.${FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS[materialType]}`);
  }, [deck.materialType, t]);
  const deckTypeLabel = React.useMemo(() => {
    if (!deck.deckType) return null;
    if (!FLASHCARD_FORMATS.includes(deck.deckType as FlashcardFormat)) {
      return deck.deckType;
    }
    const deckType = deck.deckType as FlashcardFormat;
    return t(FLASHCARD_FORMAT_LABEL_KEYS[deckType]);
  }, [deck.deckType, t]);

  const badges = React.useMemo(() => {
    const next = [];
    if (materialTypeLabel) {
      next.push({
        key: 'material',
        label: materialTypeLabel,
      });
    }
    if (deckTypeLabel) {
      next.push({
        key: 'deckType',
        label: deckTypeLabel,
      });
    }
    if (languageLabel) {
      next.push({
        key: 'locale',
        label: languageFlag ? `${languageFlag} ${languageLabel}` : languageLabel,
      });
    }
    if (deck.marketplaceMetadata?.level) {
      next.push({
        key: 'level',
        label: deck.marketplaceMetadata.level,
      });
    }
    if (deck.marketplaceMetadata?.regionalVariant) {
      next.push({
        key: 'regionalVariant',
        label: deck.marketplaceMetadata.regionalVariant,
      });
    }
    if (deck.marketplaceMetadata?.script) {
      next.push({
        key: 'script',
        label: deck.marketplaceMetadata.script,
      });
    }
    if (deck.marketplaceMetadata?.license?.name) {
      next.push({
        key: 'license',
        label: deck.marketplaceMetadata.license.name,
      });
    }
    return next;
  }, [deck.marketplaceMetadata, deckTypeLabel, languageFlag, languageLabel, materialTypeLabel]);

  return (
    <SharedDeckCard
      deck={deck}
      onCardClick={() => onView(deck)}
      featuredLabel={t('web.decks.featured.label')}
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
          value: `${deck.downloadCount} ${t('marketplace.downloadsLabel')}`,
        },
        {
          key: 'views',
          icon: <Eye className="h-3.5 w-3.5" />,
          value: `${deck.viewCount} ${t('marketplace.viewsLabel')}`,
        },
      ]}
      primaryAction={{
        label: isCloning ? t('marketplace.addingToLibrary') : t('marketplace.addAction'),
        icon: <Plus className="mr-1.5 h-4 w-4" />,
        disabled: isCloning,
        onClick: (event) => {
          event.stopPropagation();
          onClone(deck);
        },
      }}
      secondaryAction={onNominate ? {
        label: t('nominations.nominate'),
        icon: <Star className="mr-1 h-4 w-4" />,
        variant: 'ghost',
        className: 'text-yellow-700 hover:bg-yellow-50 hover:text-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-500/10 dark:hover:text-yellow-200',
        onClick: (event) => {
          event.stopPropagation();
          onNominate(deck);
        },
      } : undefined}
    />
  );
}
