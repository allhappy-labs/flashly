/**
 * FilterPanel - Responsive filters for marketplace
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, X } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { MarketplaceFilterOption, FilterPanelProps } from '../types/marketplace.types';
import type { RomanizationPreference } from '@flashly/shared/src';

type FilterKey =
  | 'materialType'
  | 'deckType'
  | 'locale'
  | 'level'
  | 'skill'
  | 'regionalVariant'
  | 'hasAudio'
  | 'script'
  | 'romanization';

type FilterRow = Readonly<{
  id: FilterKey;
  label: string;
  value: string | undefined;
  options: MarketplaceFilterOption[];
  placeholder: string;
}>;

type FilterGroup = Readonly<{
  id: 'core' | 'learning' | 'language';
  title: string;
  rows: FilterRow[];
}>;

function isRomanizationPreference(value: string | undefined): value is RomanizationPreference {
  return value === 'native_only' || value === 'with_romanization' || value === 'romanized_only';
}

function getOptionLabel(value: string, options: MarketplaceFilterOption[]): string {
  const match = options.find((option) => option.value === value);
  return match?.label ?? value;
}

export function FilterPanel({
  materialType,
  deckType,
  locale,
  level,
  skill,
  regionalVariant,
  hasAudio,
  script,
  romanization,
  materialTypeOptions,
  deckTypeOptions,
  localeOptions,
  levelOptions,
  skillOptions,
  regionalVariantOptions,
  hasAudioOptions,
  scriptOptions,
  romanizationOptions,
  onFilterChange,
}: FilterPanelProps) {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = React.useState(false);
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

  const hasNoFilterOptions =
    materialTypeOptions.length === 0
    && deckTypeOptions.length === 0
    && localeOptions.length === 0
    && levelOptions.length === 0
    && skillOptions.length === 0
    && regionalVariantOptions.length === 0
    && scriptOptions.length === 0
    && romanizationOptions.length === 0;

  const filterRows = React.useMemo<FilterRow[]>(
    () => [
      {
        id: 'materialType',
        label: t('decks.materialType'),
        value: materialType,
        options: materialTypeOptions,
        placeholder: t('decks.filters.materialPlaceholder'),
      },
      {
        id: 'deckType',
        label: t('decks.deckType'),
        value: deckType,
        options: deckTypeOptions,
        placeholder: t('decks.filters.deckTypePlaceholder'),
      },
      {
        id: 'locale',
        label: t('decks.locale'),
        value: locale,
        options: localeOptions,
        placeholder: t('decks.filters.localePlaceholder'),
      },
      {
        id: 'level',
        label: t('marketplace.levelFilter'),
        value: level,
        options: levelOptions,
        placeholder: t('marketplace.levelFilter'),
      },
      {
        id: 'skill',
        label: t('marketplace.skillFilter'),
        value: skill,
        options: skillOptions,
        placeholder: t('marketplace.skillFilter'),
      },
      {
        id: 'hasAudio',
        label: t('marketplace.audioFilter'),
        value: hasAudio === undefined ? undefined : String(hasAudio),
        options: hasAudioOptions,
        placeholder: t('marketplace.audioFilter'),
      },
      {
        id: 'regionalVariant',
        label: t('marketplace.regionalVariantFilter'),
        value: regionalVariant,
        options: regionalVariantOptions,
        placeholder: t('marketplace.regionalVariantFilter'),
      },
      {
        id: 'script',
        label: t('marketplace.scriptFilter'),
        value: script,
        options: scriptOptions,
        placeholder: t('marketplace.scriptFilter'),
      },
      {
        id: 'romanization',
        label: t('marketplace.romanizationFilter'),
        value: romanization,
        options: romanizationOptions,
        placeholder: t('marketplace.romanizationFilter'),
      },
    ],
    [
      deckType,
      deckTypeOptions,
      hasAudio,
      hasAudioOptions,
      level,
      levelOptions,
      locale,
      localeOptions,
      materialType,
      materialTypeOptions,
      regionalVariant,
      regionalVariantOptions,
      romanization,
      romanizationOptions,
      script,
      scriptOptions,
      skill,
      skillOptions,
      t,
    ]
  );

  const filterGroups = React.useMemo<FilterGroup[]>(() => {
    const getRow = (id: FilterKey): FilterRow | undefined => {
      return filterRows.find((row) => row.id === id);
    };

    return [
      {
        id: 'core',
        title: `${t('decks.materialType')} / ${t('decks.deckType')}`,
        rows: [getRow('materialType'), getRow('deckType'), getRow('locale')].filter(
          (row): row is FilterRow => row !== undefined
        ),
      },
      {
        id: 'learning',
        title: `${t('marketplace.levelFilter')} / ${t('marketplace.skillFilter')}`,
        rows: [getRow('level'), getRow('skill'), getRow('hasAudio')].filter(
          (row): row is FilterRow => row !== undefined
        ),
      },
      {
        id: 'language',
        title: `${t('marketplace.regionalVariantFilter')} / ${t('marketplace.scriptFilter')}`,
        rows: [getRow('regionalVariant'), getRow('script'), getRow('romanization')].filter(
          (row): row is FilterRow => row !== undefined
        ),
      },
    ];
  }, [filterRows, t]);

  const handleClearAll = () => {
    onFilterChange({
      materialType: undefined,
      deckType: undefined,
      locale: undefined,
      level: undefined,
      skill: undefined,
      regionalVariant: undefined,
      hasAudio: undefined,
      script: undefined,
      romanization: undefined,
    });
  };

  const handleRemove = (filter: FilterKey) => {
    onFilterChange({
      materialType: filter === 'materialType' ? undefined : materialType,
      deckType: filter === 'deckType' ? undefined : deckType,
      locale: filter === 'locale' ? undefined : locale,
      level: filter === 'level' ? undefined : level,
      skill: filter === 'skill' ? undefined : skill,
      regionalVariant: filter === 'regionalVariant' ? undefined : regionalVariant,
      hasAudio: filter === 'hasAudio' ? undefined : hasAudio,
      script: filter === 'script' ? undefined : script,
      romanization: filter === 'romanization' ? undefined : romanization,
    });
  };

  const handleFieldChange = (filterId: FilterKey, value: string | undefined) => {
    const nextHasAudio = filterId === 'hasAudio'
      ? (value === undefined ? undefined : value === 'true')
      : hasAudio;
    const nextRomanization = filterId === 'romanization'
      ? (isRomanizationPreference(value) ? value : undefined)
      : romanization;

    onFilterChange({
      materialType: filterId === 'materialType' ? value : materialType,
      deckType: filterId === 'deckType' ? value : deckType,
      locale: filterId === 'locale' ? value : locale,
      level: filterId === 'level' ? value : level,
      skill: filterId === 'skill' ? value : skill,
      regionalVariant: filterId === 'regionalVariant' ? value : regionalVariant,
      hasAudio: nextHasAudio,
      script: filterId === 'script' ? value : script,
      romanization: nextRomanization,
    });
  };

  const activeBadges = React.useMemo(() => {
    const badges: Array<{ id: FilterKey; label: string }> = [];

    if (materialType) {
      badges.push({ id: 'materialType', label: `${t('decks.materialType')}: ${getOptionLabel(materialType, materialTypeOptions)}` });
    }
    if (deckType) {
      badges.push({ id: 'deckType', label: `${t('decks.deckType')}: ${getOptionLabel(deckType, deckTypeOptions)}` });
    }
    if (locale) {
      badges.push({ id: 'locale', label: `${t('decks.locale')}: ${getOptionLabel(locale, localeOptions)}` });
    }
    if (level) {
      badges.push({ id: 'level', label: `${t('marketplace.levelFilter')}: ${getOptionLabel(level, levelOptions)}` });
    }
    if (skill) {
      badges.push({ id: 'skill', label: `${t('marketplace.skillFilter')}: ${getOptionLabel(skill, skillOptions)}` });
    }
    if (regionalVariant) {
      badges.push({
        id: 'regionalVariant',
        label: `${t('marketplace.regionalVariantFilter')}: ${getOptionLabel(regionalVariant, regionalVariantOptions)}`,
      });
    }
    if (hasAudio !== undefined) {
      badges.push({
        id: 'hasAudio',
        label: `${t('marketplace.audioFilter')}: ${getOptionLabel(String(hasAudio), hasAudioOptions)}`,
      });
    }
    if (script) {
      badges.push({ id: 'script', label: `${t('marketplace.scriptFilter')}: ${getOptionLabel(script, scriptOptions)}` });
    }
    if (romanization) {
      badges.push({
        id: 'romanization',
        label: `${t('marketplace.romanizationFilter')}: ${getOptionLabel(romanization, romanizationOptions)}`,
      });
    }

    return badges;
  }, [
    deckType,
    deckTypeOptions,
    hasAudio,
    hasAudioOptions,
    level,
    levelOptions,
    locale,
    localeOptions,
    materialType,
    materialTypeOptions,
    regionalVariant,
    regionalVariantOptions,
    romanization,
    romanizationOptions,
    script,
    scriptOptions,
    skill,
    skillOptions,
    t,
  ]);

  return (
    <div className="space-y-3">
      <div className="lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="inline-flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {t('decks.filters.open')}
              </span>
              <Badge variant={activeFiltersCount > 0 ? 'default' : 'secondary'}>
                {activeFiltersCount}
              </Badge>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh] overflow-y-auto">
            <SheetHeader className="px-0">
              <SheetTitle>{t('decks.filters.title')}</SheetTitle>
              <SheetDescription>{t('decks.filters.description')}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-0 py-4">
              {filterRows.map((filterRow) => (
                <div key={filterRow.id} className="space-y-2">
                  <Label>{filterRow.label}</Label>
                  <FilterSelect
                    value={filterRow.value}
                    options={filterRow.options}
                    placeholder={filterRow.placeholder}
                    onChange={(value) => handleFieldChange(filterRow.id, value)}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleClearAll}
                  disabled={activeFiltersCount === 0}
                >
                  {t('decks.filters.clearAll')}
                </Button>
                <Button className="flex-1" onClick={() => setSheetOpen(false)}>
                  {t('common.apply')}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden lg:block rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('decks.filters.title')}
          </h2>
          <Badge variant={activeFiltersCount > 0 ? 'default' : 'secondary'}>
            {activeFiltersCount}
          </Badge>
        </div>

        <Accordion type="multiple" className="w-full">
          {filterGroups.map((group) => (
            <AccordionItem key={group.id} value={group.id}>
              <AccordionTrigger className="py-3 text-sm font-semibold no-underline hover:no-underline">
                {group.title}
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                {group.rows.map((filterRow) => (
                  <div key={filterRow.id} className="space-y-2">
                    <Label>{filterRow.label}</Label>
                    <FilterSelect
                      value={filterRow.value}
                      options={filterRow.options}
                      placeholder={filterRow.placeholder}
                      onChange={(value) => handleFieldChange(filterRow.id, value)}
                    />
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={handleClearAll}
          disabled={activeFiltersCount === 0}
        >
          {t('decks.filters.clearAll')}
        </Button>
      </div>

      {(activeFiltersCount > 0 || hasNoFilterOptions) && (
        <div className="flex items-center gap-3 flex-wrap">
          {activeFiltersCount > 0 && (
            <span className="text-sm text-muted-foreground">{t('decks.filters.active')}</span>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {activeBadges.map((badge) => (
              <Badge key={badge.id} variant="secondary" className="gap-1">
                {badge.label}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => handleRemove(badge.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearAll}>
              {t('decks.filters.clearAll')}
            </Button>
          )}
          {hasNoFilterOptions && (
            <p className="text-sm text-muted-foreground">{t('decks.filters.noOptions')}</p>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelect(props: {
  value: string | undefined;
  options: FilterPanelProps['materialTypeOptions'];
  placeholder: string;
  onChange: (value: string | undefined) => void;
}) {
  const { t } = useTranslation();

  return (
    <Select
      value={props.value ?? 'all'}
      onValueChange={(value) => {
        props.onChange(value === 'all' ? undefined : value);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={props.placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t('common.all')}</SelectItem>
        {props.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.icon ? `${option.icon} ${option.label}` : option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
