/**
 * SortSelect - Dropdown for selecting sort option
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SortSelectProps } from '../types/marketplace.types';

export function SortSelect({ value, onChange }: SortSelectProps) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={t('decks.sort.sortBy')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">{t('decks.sort.newest')}</SelectItem>
        <SelectItem value="most_downloaded">{t('decks.sort.mostDownloaded')}</SelectItem>
        <SelectItem value="most_viewed">{t('decks.sort.mostViewed')}</SelectItem>
      </SelectContent>
    </Select>
  );
}
