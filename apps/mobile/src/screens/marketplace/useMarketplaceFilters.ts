import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  FLASHCARD_FORMATS,
  FLASHCARD_MATERIAL_TYPES,
  type FlashcardFormat,
  type RomanizationPreference,
} from '@flashly/shared';
import type { MarketplaceSortBy } from '../../services/marketplace/marketplace-types';
import { toRecord } from '../../utils/records';

export const ALL_FILTER = '__all__';
const FILTER_STORAGE_KEY = 'flashly.marketplace.filters.v2';

export type SortPreset = 'newest' | 'downloads' | 'views';

type PersistedFilters = Readonly<{
  materialType: string | null;
  deckType: string | null;
  locale: string | null;
  level: string | null;
  skill: string | null;
  regionalVariant: string | null;
  hasAudio: boolean | null;
  script: string | null;
  romanization: RomanizationPreference | null;
  licenseCode: string | null;
  sortPreset: SortPreset;
}>;

type SortPresetConfig = Readonly<{
  id: SortPreset;
  sortBy: MarketplaceSortBy;
  sortOrder: 'asc' | 'desc';
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
}>;

type DeckTypeOption = Readonly<{
  value: FlashcardFormat;
  label: string;
}>;

export const SORT_PRESETS: ReadonlyArray<SortPresetConfig> = [
  { id: 'newest', sortBy: 'newest', sortOrder: 'desc', icon: 'sparkles-outline', labelKey: 'marketplace.sortNewest' },
  { id: 'downloads', sortBy: 'most_downloaded', sortOrder: 'desc', icon: 'download-outline', labelKey: 'marketplace.sortMostDownloaded' },
  { id: 'views', sortBy: 'most_viewed', sortOrder: 'desc', icon: 'trending-up-outline', labelKey: 'marketplace.sortMostViewed' },
];

const FLASHCARD_FORMAT_LABEL_KEYS: Record<FlashcardFormat, string> = {
  QA: 'web.flashcards.format.qaLabel',
  Cloze: 'web.flashcards.format.clozeLabel',
  Definition: 'web.flashcards.format.definitionLabel',
};

function isFlashcardFormat(value: string): value is FlashcardFormat {
  return FLASHCARD_FORMATS.some((format) => format === value);
}

function normalizeDeckTypeFilter(value: string | null): FlashcardFormat | null {
  if (!value) {
    return null;
  }

  if (isFlashcardFormat(value)) {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'q&a' || normalized === 'qa') {
    return 'QA';
  }
  if (normalized === 'cloze') {
    return 'Cloze';
  }
  if (normalized === 'definition' || normalized === 'definitions') {
    return 'Definition';
  }

  return null;
}

function isSortPreset(value: unknown): value is SortPreset {
  return value === 'newest' || value === 'downloads' || value === 'views';
}

function isRomanizationPreference(value: unknown): value is RomanizationPreference {
  return value === 'native_only'
    || value === 'with_romanization'
    || value === 'romanized_only';
}

function parsePersistedFilters(raw: string): PersistedFilters | null {
  try {
    const parsed = toRecord(JSON.parse(raw));
    if (!parsed) {
      return null;
    }

    const materialType = typeof parsed.materialType === 'string' || parsed.materialType === null
      ? parsed.materialType
      : null;
    const deckType = typeof parsed.deckType === 'string' || parsed.deckType === null
      ? parsed.deckType
      : null;
    const locale = typeof parsed.locale === 'string' || parsed.locale === null
      ? parsed.locale
      : null;
    const level = typeof parsed.level === 'string' || parsed.level === null
      ? parsed.level
      : null;
    const skill = typeof parsed.skill === 'string' || parsed.skill === null
      ? parsed.skill
      : null;
    const regionalVariant = typeof parsed.regionalVariant === 'string' || parsed.regionalVariant === null
      ? parsed.regionalVariant
      : null;
    const hasAudio = typeof parsed.hasAudio === 'boolean' || parsed.hasAudio === null
      ? parsed.hasAudio
      : null;
    const script = typeof parsed.script === 'string' || parsed.script === null
      ? parsed.script
      : null;
    const romanization = isRomanizationPreference(parsed.romanization)
      ? parsed.romanization
      : null;
    const licenseCode = typeof parsed.licenseCode === 'string' || parsed.licenseCode === null
      ? parsed.licenseCode
      : null;
    const sortPreset = isSortPreset(parsed.sortPreset) ? parsed.sortPreset : 'newest';

    return {
      materialType,
      deckType,
      locale,
      level,
      skill,
      regionalVariant,
      hasAudio,
      script,
      romanization,
      licenseCode,
      sortPreset,
    };
  } catch {
    return null;
  }
}

type TranslateFn = (key: string) => string;

export function useMarketplaceFilters(t: TranslateFn) {
  const [selectedMaterialType, setSelectedMaterialType] = useState<string | null>(null);
  const [selectedDeckType, setSelectedDeckType] = useState<FlashcardFormat | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedRegionalVariant, setSelectedRegionalVariant] = useState<string | null>(null);
  const [selectedHasAudio, setSelectedHasAudio] = useState<boolean | null>(null);
  const [selectedScript, setSelectedScript] = useState<string | null>(null);
  const [selectedRomanization, setSelectedRomanization] = useState<RomanizationPreference | null>(null);
  const [selectedLicenseCode, setSelectedLicenseCode] = useState<string | null>(null);
  const [sortPreset, setSortPreset] = useState<SortPreset>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);

  const materialTabs = useMemo(() => [ALL_FILTER, ...FLASHCARD_MATERIAL_TYPES], []);
  const activeSort = SORT_PRESETS.find((preset) => preset.id === sortPreset) ?? SORT_PRESETS[0];
  const deckTypeOptions = useMemo<ReadonlyArray<DeckTypeOption>>(
    () =>
      FLASHCARD_FORMATS.map((format) => ({
        value: format,
        label: t(FLASHCARD_FORMAT_LABEL_KEYS[format]),
      })),
    [t]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedMaterialType) count += 1;
    if (selectedDeckType) count += 1;
    if (selectedLocale) count += 1;
    if (selectedLevel) count += 1;
    if (selectedSkill) count += 1;
    if (selectedRegionalVariant) count += 1;
    if (selectedHasAudio !== null) count += 1;
    if (selectedScript) count += 1;
    if (selectedRomanization) count += 1;
    if (selectedLicenseCode) count += 1;
    return count;
  }, [
    selectedDeckType,
    selectedHasAudio,
    selectedLevel,
    selectedLicenseCode,
    selectedLocale,
    selectedMaterialType,
    selectedRegionalVariant,
    selectedRomanization,
    selectedScript,
    selectedSkill,
  ]);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(FILTER_STORAGE_KEY)
      .then((value) => {
        if (!active || !value) {
          return;
        }

        const parsed = parsePersistedFilters(value);
        if (!parsed) {
          return;
        }

        setSelectedMaterialType(parsed.materialType);
        setSelectedDeckType(normalizeDeckTypeFilter(parsed.deckType));
        setSelectedLocale(parsed.locale);
        setSelectedLevel(parsed.level);
        setSelectedSkill(parsed.skill);
        setSelectedRegionalVariant(parsed.regionalVariant);
        setSelectedHasAudio(parsed.hasAudio);
        setSelectedScript(parsed.script);
        setSelectedRomanization(parsed.romanization);
        setSelectedLicenseCode(parsed.licenseCode);
        setSortPreset(parsed.sortPreset);
      })
      .finally(() => {
        if (active) {
          setIsHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const payload: PersistedFilters = {
      materialType: selectedMaterialType,
      deckType: selectedDeckType,
      locale: selectedLocale,
      level: selectedLevel,
      skill: selectedSkill,
      regionalVariant: selectedRegionalVariant,
      hasAudio: selectedHasAudio,
      script: selectedScript,
      romanization: selectedRomanization,
      licenseCode: selectedLicenseCode,
      sortPreset,
    };
    void AsyncStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(payload));
  }, [
    isHydrated,
    selectedDeckType,
    selectedHasAudio,
    selectedLevel,
    selectedLicenseCode,
    selectedLocale,
    selectedMaterialType,
    selectedRegionalVariant,
    selectedRomanization,
    selectedScript,
    selectedSkill,
    sortPreset,
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 280);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  return {
    selectedMaterialType,
    setSelectedMaterialType,
    selectedDeckType,
    setSelectedDeckType,
    selectedLocale,
    setSelectedLocale,
    selectedLevel,
    setSelectedLevel,
    selectedSkill,
    setSelectedSkill,
    selectedRegionalVariant,
    setSelectedRegionalVariant,
    selectedHasAudio,
    setSelectedHasAudio,
    selectedScript,
    setSelectedScript,
    selectedRomanization,
    setSelectedRomanization,
    selectedLicenseCode,
    setSelectedLicenseCode,
    sortPreset,
    setSortPreset,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    isHydrated,
    filtersModalVisible,
    setFiltersModalVisible,
    materialTabs,
    activeSort,
    deckTypeOptions,
    activeFilterCount,
  };
}
