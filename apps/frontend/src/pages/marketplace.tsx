/**
 * Marketplace Page - Browse public decks with search, filtering, and deck previews
 */

import * as React from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { CloneDeckDialog } from '@/features/marketplace/components/clone-deck-dialog';
import { FeaturedSection } from '@/features/marketplace/components/featured-section';
import { FilterPanel } from '@/features/marketplace/components/filter-panel';
import { MarketplaceCard } from '@/features/marketplace/components/marketplace-card';
import { MarketplaceDeckDialog } from '@/features/marketplace/components/marketplace-deck-dialog';
import { SearchBar } from '@/features/marketplace/components/search-bar';
import { SortSelect } from '@/features/marketplace/components/sort-select';
import { useCloneDeck } from '@/features/marketplace/hooks/use-clone-deck';
import { useFeaturedDecks } from '@/features/marketplace/hooks/use-featured-decks';
import { useMarketplace } from '@/features/marketplace/hooks/use-marketplace';
import { useMarketplaceDeck } from '@/features/marketplace/hooks/use-marketplace-deck';
import type {
  MarketplaceFilterOption,
  MarketplaceSortValue,
} from '@/features/marketplace/types/marketplace.types';
import {
  DEFAULT_MARKETPLACE_SORT,
  getMarketplaceStateFromSearch,
  type MarketplaceUrlState,
} from '@/features/marketplace/utils/marketplace-url-state';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { NominateDialog } from '@/features/nominations/components/nominate-dialog';
import { getFlagEmoji } from '@/components/ui/language-combobox';
import { useAuth } from '@/hooks/use-auth';
import type { DeckWithCardCount } from '@/types/api.types';
import {
  FLASHCARD_FORMATS,
  ELEVENLABS_V3_LANGUAGES,
  FLASHCARD_MATERIAL_TYPES,
  FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS,
  type FlashcardFormat,
  type RomanizationPreference,
  ROMANIZATION_PREFERENCES,
} from '@flashly/shared/src';

const FLASHCARD_FORMAT_LABEL_KEYS: Record<FlashcardFormat, string> = {
  QA: 'web.flashcards.format.qaLabel',
  Cloze: 'web.flashcards.format.clozeLabel',
  Definition: 'web.flashcards.format.definitionLabel',
};

const DEFAULT_SORT: MarketplaceSortValue = DEFAULT_MARKETPLACE_SORT;
const FLASHCARD_FORMAT_SET = new Set<string>(FLASHCARD_FORMATS);
const ROMANIZATION_PREFERENCE_SET = new Set<string>(ROMANIZATION_PREFERENCES);

function isFlashcardFormat(value: string): value is FlashcardFormat {
  return FLASHCARD_FORMAT_SET.has(value);
}

function isRomanizationPreference(value: string): value is RomanizationPreference {
  return ROMANIZATION_PREFERENCE_SET.has(value);
}

export function Marketplace() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canNominateDecks = Boolean(user?.isAdmin);
  const urlState = React.useMemo(() => getMarketplaceStateFromSearch(location.search), [location.search]);

  const [searchInput, setSearchInput] = React.useState(urlState.search);
  const [materialType, setMaterialType] = React.useState<string | undefined>(urlState.materialType);
  const [deckType, setDeckType] = React.useState<string | undefined>(urlState.deckType);
  const [locale, setLocale] = React.useState<string | undefined>(urlState.locale);
  const [level, setLevel] = React.useState<string | undefined>(urlState.level);
  const [skill, setSkill] = React.useState<string | undefined>(urlState.skill);
  const [regionalVariant, setRegionalVariant] = React.useState<string | undefined>(urlState.regionalVariant);
  const [hasAudio, setHasAudio] = React.useState<boolean | undefined>(urlState.hasAudio);
  const [script, setScript] = React.useState<string | undefined>(urlState.script);
  const [romanization, setRomanization] = React.useState<RomanizationPreference | undefined>(urlState.romanization);
  const [sortBy, setSortBy] = React.useState<MarketplaceSortValue>(urlState.sortBy);
  const [page, setPage] = React.useState(urlState.page);

  const [selectedDeck, setSelectedDeck] = React.useState<DeckWithCardCount | null>(null);
  const [deckDialogOpen, setDeckDialogOpen] = React.useState(false);

  const [cloneDeck, setCloneDeck] = React.useState<DeckWithCardCount | null>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = React.useState(false);

  const [nominateDeck, setNominateDeck] = React.useState<DeckWithCardCount | null>(null);
  const [nominateDialogOpen, setNominateDialogOpen] = React.useState(false);

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const activeFiltersCount = [
    materialType,
    deckType,
    locale,
    level,
    skill,
    regionalVariant,
    script,
    romanization,
  ].filter(Boolean).length + (hasAudio !== undefined ? 1 : 0);

  const { data: featuredDecksResult, isLoading: isLoadingFeatured } = useFeaturedDecks(10);
  const featuredDecks = featuredDecksResult ?? null;
  const { data: marketplaceDataResult, error: marketplaceErrorResult, isLoading } = useMarketplace({
    materialType,
    deckType,
    locale,
    level,
    skill,
    regionalVariant,
    hasAudio,
    script,
    romanization,
    search: debouncedSearch,
    sortBy,
    page,
    limit: 12,
  });
  const marketplaceData = marketplaceDataResult ?? null;
  const marketplaceError = marketplaceErrorResult ?? null;
  const {
    data: selectedDeckDetails,
    error: selectedDeckError,
    isLoading: isLoadingSelectedDeck,
  } = useMarketplaceDeck(deckDialogOpen ? selectedDeck?.id : undefined);

  React.useEffect(() => {
    setSearchInput((current) => (current === urlState.search ? current : urlState.search));
    setMaterialType((current) => (current === urlState.materialType ? current : urlState.materialType));
    setDeckType((current) => (current === urlState.deckType ? current : urlState.deckType));
    setLocale((current) => (current === urlState.locale ? current : urlState.locale));
    setLevel((current) => (current === urlState.level ? current : urlState.level));
    setSkill((current) => (current === urlState.skill ? current : urlState.skill));
    setRegionalVariant((current) => (current === urlState.regionalVariant ? current : urlState.regionalVariant));
    setHasAudio((current) => (current === urlState.hasAudio ? current : urlState.hasAudio));
    setScript((current) => (current === urlState.script ? current : urlState.script));
    setRomanization((current) => (current === urlState.romanization ? current : urlState.romanization));
    setSortBy((current) => (current === urlState.sortBy ? current : urlState.sortBy));
    setPage((current) => (current === urlState.page ? current : urlState.page));
  }, [urlState]);

  React.useEffect(() => {
    const trimmedSearch = searchInput.trim();
    const nextUrlState: MarketplaceUrlState = {
      search: trimmedSearch,
      materialType,
      deckType,
      locale,
      level,
      skill,
      regionalVariant,
      hasAudio,
      script,
      romanization,
      sortBy,
      page,
    };

    if (
      nextUrlState.search === urlState.search
      && nextUrlState.materialType === urlState.materialType
      && nextUrlState.deckType === urlState.deckType
      && nextUrlState.locale === urlState.locale
      && nextUrlState.level === urlState.level
      && nextUrlState.skill === urlState.skill
      && nextUrlState.regionalVariant === urlState.regionalVariant
      && nextUrlState.hasAudio === urlState.hasAudio
      && nextUrlState.script === urlState.script
      && nextUrlState.romanization === urlState.romanization
      && nextUrlState.sortBy === urlState.sortBy
      && nextUrlState.page === urlState.page
    ) {
      return;
    }

    void navigate({
      to: '/marketplace',
      replace: true,
      resetScroll: false,
      search: (previousSearch) => ({
        ...previousSearch,
        q: trimmedSearch || undefined,
        materialType: materialType || undefined,
        deckType: deckType || undefined,
        locale: locale || undefined,
        level: level || undefined,
        skill: skill || undefined,
        regionalVariant: regionalVariant || undefined,
        hasAudio: hasAudio === undefined ? undefined : String(hasAudio),
        script: script || undefined,
        romanization: romanization || undefined,
        licenseCode: undefined,
        sort: sortBy !== DEFAULT_SORT ? sortBy : undefined,
        page: page > 1 ? page : undefined,
      }),
    });
  }, [
    deckType,
    hasAudio,
    level,
    locale,
    materialType,
    navigate,
    page,
    regionalVariant,
    romanization,
    script,
    searchInput,
    skill,
    sortBy,
    urlState,
  ]);

  const cloneDeckHandlers = React.useMemo(
    () => ({
      onSuccess: (deck: { id: string }) => {
        toast.success(t('decks.clone.success'));
        setCloneDialogOpen(false);
        setCloneDeck(null);
        navigate({ to: `/deck-editor/${deck.id}` });
      },
      onError: (cloneError: Error) => {
        toast.error(cloneError.message || t('decks.clone.error'));
      },
    }),
    [t, navigate]
  );

  const { mutate: cloneDeckMutation, isLoading: isCloning } = useCloneDeck(cloneDeckHandlers);

  const allVisibleDecks = React.useMemo(() => {
    const map = new Map<string, DeckWithCardCount>();
    for (const deck of featuredDecks ?? []) {
      map.set(deck.id, deck);
    }
    for (const deck of marketplaceData?.items ?? []) {
      map.set(deck.id, deck);
    }
    return Array.from(map.values());
  }, [featuredDecks, marketplaceData?.items]);

  const materialTypeOptions = React.useMemo<MarketplaceFilterOption[]>(() => {
    const knownOptions = FLASHCARD_MATERIAL_TYPES.map((type) => ({
      value: type,
      label: t(`web.flashcards.material.${FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS[type]}`),
    }));

    const knownSet = new Set<string>(knownOptions.map((option) => option.value));
    const extraOptions = allVisibleDecks
      .map((deck) => deck.materialType)
      .filter((value): value is string => {
        if (!value) return false;
        return !knownSet.has(value);
      })
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({
        value,
        label: value,
      }));

    return [...knownOptions, ...extraOptions];
  }, [allVisibleDecks, t]);

  const deckTypeOptions = React.useMemo<MarketplaceFilterOption[]>(() => {
    return Array.from(
      new Set(
        allVisibleDecks
          .map((deck) => deck.deckType)
          .filter((value): value is string => Boolean(value))
      )
    )
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({
        value,
        label: isFlashcardFormat(value)
          ? t(FLASHCARD_FORMAT_LABEL_KEYS[value])
          : value,
      }));
  }, [allVisibleDecks, t]);

  const localeOptions = React.useMemo<MarketplaceFilterOption[]>(() => {
    return Array.from(
      new Set(
        allVisibleDecks
          .map((deck) => deck.locale)
          .filter((value): value is string => Boolean(value))
      )
    )
      .sort((left, right) => left.localeCompare(right))
      .map((value) => {
        const languageLabel = ELEVENLABS_V3_LANGUAGES.find((language) => language.code === value)?.name ?? value.toUpperCase();
        return {
          value,
          label: languageLabel,
          icon: getFlagEmoji(value),
        };
      });
  }, [allVisibleDecks]);

  const levelOptions = React.useMemo<MarketplaceFilterOption[]>(() => {
    return Array.from(
      new Set(
        allVisibleDecks
          .map((deck) => deck.marketplaceMetadata?.level)
          .filter((value): value is string => Boolean(value))
      )
    )
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ value, label: value }));
  }, [allVisibleDecks]);

  const skillOptions = React.useMemo<MarketplaceFilterOption[]>(() => {
    const skills = new Set<string>();
    for (const deck of allVisibleDecks) {
      const deckSkills = deck.marketplaceMetadata?.skills;
      if (!Array.isArray(deckSkills)) {
        continue;
      }
      for (const deckSkill of deckSkills) {
        const normalized = deckSkill.trim();
        if (normalized.length > 0) {
          skills.add(normalized);
        }
      }
    }
    return Array.from(skills)
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ value, label: value }));
  }, [allVisibleDecks]);

  const regionalVariantOptions = React.useMemo<MarketplaceFilterOption[]>(() => {
    return Array.from(
      new Set(
        allVisibleDecks
          .map((deck) => deck.marketplaceMetadata?.regionalVariant)
          .filter((value): value is string => Boolean(value))
      )
    )
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ value, label: value }));
  }, [allVisibleDecks]);

  const scriptOptions = React.useMemo<MarketplaceFilterOption[]>(() => {
    return Array.from(
      new Set(
        allVisibleDecks
          .map((deck) => deck.marketplaceMetadata?.script)
          .filter((value): value is string => Boolean(value))
      )
    )
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ value, label: value }));
  }, [allVisibleDecks]);

  const romanizationOptions = React.useMemo<MarketplaceFilterOption[]>(() => {
    return Array.from(
      new Set(
        allVisibleDecks
          .map((deck) => deck.marketplaceMetadata?.romanization)
          .filter((value): value is RomanizationPreference => typeof value === 'string' && isRomanizationPreference(value))
      )
    )
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({
        value,
        label: t(`marketplace.romanization.${value}`),
      }));
  }, [allVisibleDecks, t]);

  const hasAudioOptions = React.useMemo<MarketplaceFilterOption[]>(() => {
    return [
      { value: 'true', label: t('marketplace.audioAvailable') },
      { value: 'false', label: t('marketplace.audioUnavailable') },
    ];
  }, [t]);

  const handleFilterChange = (filters: {
    materialType?: string;
    deckType?: string;
    locale?: string;
    level?: string;
    skill?: string;
    regionalVariant?: string;
    hasAudio?: boolean;
    script?: string;
    romanization?: RomanizationPreference;
  }) => {
    setMaterialType(filters.materialType);
    setDeckType(filters.deckType);
    setLocale(filters.locale);
    setLevel(filters.level);
    setSkill(filters.skill);
    setRegionalVariant(filters.regionalVariant);
    setHasAudio(filters.hasAudio);
    setScript(filters.script);
    setRomanization(filters.romanization);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  const handleSortChange = (value: MarketplaceSortValue) => {
    setSortBy(value);
    setPage(1);
  };

  const handleOpenDeckDetails = (deck: DeckWithCardCount) => {
    setSelectedDeck(deck);
    setDeckDialogOpen(true);
  };

  const handleCloneDeck = (deck: DeckWithCardCount) => {
    setDeckDialogOpen(false);
    setCloneDeck(deck);
    setCloneDialogOpen(true);
  };

  const handleCloneConfirm = () => {
    if (!cloneDeck) return;
    cloneDeckMutation(cloneDeck.id);
  };

  const handleNominateDeck = (deck: DeckWithCardCount) => {
    if (!canNominateDecks) return;
    setDeckDialogOpen(false);
    setNominateDeck(deck);
    setNominateDialogOpen(true);
  };

  const handleNominateOpenChange = (open: boolean) => {
    setNominateDialogOpen(open);
    if (!open) {
      setNominateDeck(null);
    }
  };

  const handleClearFilters = () => {
    setMaterialType(undefined);
    setDeckType(undefined);
    setLocale(undefined);
    setLevel(undefined);
    setSkill(undefined);
    setRegionalVariant(undefined);
    setHasAudio(undefined);
    setScript(undefined);
    setRomanization(undefined);
    setPage(1);
  };

  if (marketplaceError) {
    return (
      <div className="space-y-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t('decks.marketplace')}</h1>
          <p className="text-muted-foreground mt-1">{t('decks.marketplaceDescription')}</p>
        </div>
        <div className="text-destructive">{marketplaceError.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/50 p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-6 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('decks.marketplace')}</h1>
              <p className="mt-1 text-muted-foreground">{t('decks.marketplaceDescription')}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <HeroStat
                label={t('decks.marketplaceHero.totalDecks')}
                value={String(marketplaceData?.total ?? 0)}
              />
              <HeroStat
                label={t('decks.marketplaceHero.featuredDecks')}
                value={String(featuredDecks?.length ?? 0)}
              />
              <HeroStat
                label={t('decks.marketplaceHero.activeFilters')}
                value={String(activeFiltersCount)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm">
        <SearchBar value={searchInput} onChange={handleSearchChange} />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20">
          <FilterPanel
            materialType={materialType}
            deckType={deckType}
            locale={locale}
            level={level}
            skill={skill}
            regionalVariant={regionalVariant}
            hasAudio={hasAudio}
            script={script}
            romanization={romanization}
            materialTypeOptions={materialTypeOptions}
            deckTypeOptions={deckTypeOptions}
            localeOptions={localeOptions}
            levelOptions={levelOptions}
            skillOptions={skillOptions}
            regionalVariantOptions={regionalVariantOptions}
            hasAudioOptions={hasAudioOptions}
            scriptOptions={scriptOptions}
            romanizationOptions={romanizationOptions}
            onFilterChange={handleFilterChange}
          />
        </aside>

        <div className="min-w-0 space-y-6">
          <FeaturedSection
            decks={featuredDecks ?? []}
            isLoading={isLoadingFeatured}
            onSelectDeck={handleOpenDeckDetails}
            onCloneDeck={handleCloneDeck}
            onNominateDeck={canNominateDecks ? handleNominateDeck : undefined}
          />

          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 p-3">
              <p className="text-sm text-muted-foreground">
                {t('decks.resultsCount', { count: marketplaceData?.total ?? 0 })}
              </p>
              <div className="flex items-center gap-2">
                <SortSelect value={sortBy} onChange={handleSortChange} />
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    {t('decks.filters.clearAll')}
                  </Button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`marketplace-skeleton-${index}`}
                    className="h-72 rounded-xl border border-border/70 bg-muted/30 animate-pulse"
                  />
                ))}
              </div>
            ) : marketplaceData?.items?.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {marketplaceData.items.map((deck) => (
                  <MarketplaceCard
                    key={deck.id}
                    deck={deck}
                    onView={handleOpenDeckDetails}
                    onClone={handleCloneDeck}
                    onNominate={canNominateDecks ? handleNominateDeck : undefined}
                    isCloning={isCloning && cloneDeck?.id === deck.id}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border/70 bg-card/60 p-12 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold mb-2">{t('decks.noResults.title')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('decks.noResults.description')}
                </p>
                {(activeFiltersCount > 0 || searchInput.trim()) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchInput('');
                      handleClearFilters();
                    }}
                  >
                    {t('common.reset')}
                  </Button>
                )}
              </div>
            )}

            {marketplaceData && marketplaceData.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={page === 1}
                >
                  {t('common.previous')}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t('decks.pagination', {
                    current: page,
                    total: marketplaceData.totalPages,
                  })}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  disabled={!marketplaceData.hasMore}
                >
                  {t('common.next')}
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>

      <MarketplaceDeckDialog
        open={deckDialogOpen}
        onOpenChange={setDeckDialogOpen}
        deckSummary={selectedDeck}
        deckDetails={selectedDeckDetails ?? null}
        isLoading={isLoadingSelectedDeck}
        error={selectedDeckError}
        onClone={handleCloneDeck}
        onNominate={canNominateDecks ? handleNominateDeck : undefined}
        isCloning={isCloning}
      />

      <CloneDeckDialog
        deck={cloneDeck}
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        onConfirm={handleCloneConfirm}
        isCloning={isCloning}
      />

      {canNominateDecks && nominateDeck && (
        <NominateDialog
          open={nominateDialogOpen}
          onOpenChange={handleNominateOpenChange}
          deckId={nominateDeck.id}
          deckName={nominateDeck.name}
        />
      )}
    </div>
  );
}

function HeroStat(props: { label: string; value: string }) {
  return (
    <div className="min-w-[96px] rounded-lg border border-border/70 bg-background/75 px-3 py-2">
      <p className="text-lg font-semibold leading-none">{props.value}</p>
      <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{props.label}</p>
    </div>
  );
}
