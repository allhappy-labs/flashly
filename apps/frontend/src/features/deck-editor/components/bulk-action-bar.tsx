/**
 * BulkActionBar - Floating action bar for bulk card operations
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AutocompleteTextInput } from './autocomplete-text-input';
import type { CardFieldSuggestions } from '../types/card-field-suggestions';

export interface BulkActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onUpdateCategory?: (category: string) => void;
  onUpdateTags?: (tags: string) => void;
  onClearSelection: () => void;
  isDeleting?: boolean;
  isUpdating?: boolean;
  fieldSuggestions?: CardFieldSuggestions;
}

const EMPTY_FIELD_SUGGESTIONS: CardFieldSuggestions = {
  categories: [],
  pos: [],
  genders: [],
  tags: [],
};

export function BulkActionBar({
  selectedCount,
  onDelete,
  onUpdateCategory,
  onUpdateTags,
  onClearSelection,
  isDeleting = false,
  isUpdating = false,
  fieldSuggestions = EMPTY_FIELD_SUGGESTIONS,
}: BulkActionBarProps) {
  const { t } = useTranslation();
  const [updateAction, setUpdateAction] = React.useState<'category' | 'tags' | ''>('');
  const [updateValue, setUpdateValue] = React.useState('');

  const handleUpdateActionChange = React.useCallback((value: string) => {
    if (value === 'category' || value === 'tags') {
      setUpdateAction(value);
      return;
    }
    setUpdateAction('');
  }, []);

  const handleUpdate = () => {
    if (updateAction === 'category' && onUpdateCategory && updateValue) {
      onUpdateCategory(updateValue);
    } else if (updateAction === 'tags' && onUpdateTags && updateValue) {
      onUpdateTags(updateValue);
    }
    setUpdateAction('');
    setUpdateValue('');
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-3">
        {/* Selected count */}
        <span className="text-sm font-medium">
          {selectedCount} {t('decks.cards.bulk.selected')}
        </span>

        <div className="h-4 w-px bg-border" />

        {/* Bulk actions */}
        {onUpdateCategory && (
          <>
            <Select value={updateAction} onValueChange={handleUpdateActionChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('decks.cards.bulk.update')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">{t('decks.cards.category')}</SelectItem>
                <SelectItem value="tags">{t('decks.cards.tags')}</SelectItem>
              </SelectContent>
            </Select>

            {updateAction && (
              <div className="flex items-center gap-2">
                <AutocompleteTextInput
                  placeholder={
                    updateAction === 'category'
                      ? t('decks.cards.categoryPlaceholder')
                      : t('decks.cards.tagsPlaceholder')
                  }
                  value={updateValue}
                  onChange={setUpdateValue}
                  className="w-[180px]"
                  suggestions={
                    updateAction === 'category'
                      ? fieldSuggestions.categories
                      : fieldSuggestions.tags
                  }
                  multipleTokens={updateAction === 'tags'}
                />
                <Button
                  size="sm"
                  onClick={handleUpdate}
                  disabled={!updateValue || isUpdating}
                >
                  {t('common.apply')}
                </Button>
              </div>
            )}
          </>
        )}

        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {t('common.delete')}
        </Button>

        <div className="h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
