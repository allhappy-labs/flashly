/**
 * Types specific to the marketplace feature
 */

import type { RomanizationPreference } from '@flashly/shared/src';
import type { DeckWithCardCount } from '@/types/api.types';

export type MarketplaceSortValue = 'newest' | 'most_downloaded' | 'most_viewed';

export interface MarketplaceFilterOption {
  value: string;
  label: string;
  icon?: string;
}

export interface MarketplaceCardProps {
  deck: DeckWithCardCount;
  onView: (deck: DeckWithCardCount) => void;
  onClone: (deck: DeckWithCardCount) => void;
  onNominate?: (deck: DeckWithCardCount) => void;
  isCloning?: boolean;
}

export interface CloneDeckDialogProps {
  deck: DeckWithCardCount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isCloning?: boolean;
}

export interface FeaturedSectionProps {
  decks: DeckWithCardCount[];
  isLoading?: boolean;
  onSelectDeck: (deck: DeckWithCardCount) => void;
  onCloneDeck?: (deck: DeckWithCardCount) => void;
  onNominateDeck?: (deck: DeckWithCardCount) => void;
}

export interface FilterPanelProps {
  materialType: string | undefined;
  deckType: string | undefined;
  locale: string | undefined;
  level: string | undefined;
  skill: string | undefined;
  regionalVariant: string | undefined;
  hasAudio: boolean | undefined;
  script: string | undefined;
  romanization: RomanizationPreference | undefined;
  materialTypeOptions: MarketplaceFilterOption[];
  deckTypeOptions: MarketplaceFilterOption[];
  localeOptions: MarketplaceFilterOption[];
  levelOptions: MarketplaceFilterOption[];
  skillOptions: MarketplaceFilterOption[];
  regionalVariantOptions: MarketplaceFilterOption[];
  hasAudioOptions: MarketplaceFilterOption[];
  scriptOptions: MarketplaceFilterOption[];
  romanizationOptions: MarketplaceFilterOption[];
  onFilterChange: (filters: {
    materialType?: string;
    deckType?: string;
    locale?: string;
    level?: string;
    skill?: string;
    regionalVariant?: string;
    hasAudio?: boolean;
    script?: string;
    romanization?: RomanizationPreference;
  }) => void;
}

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface SortSelectProps {
  value: MarketplaceSortValue;
  onChange: (value: MarketplaceSortValue) => void;
}
