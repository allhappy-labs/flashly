import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { LanguageCombobox } from '@/components/ui/language-combobox';
import { MaterialTypeCombobox } from '@/components/ui/material-type-combobox';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { DeckMetadataFormProps } from '../types/editor.types';
import { getAccentKeyForMaterialType } from '@/utils/deck-accent';
import {
  ELEVENLABS_V3_LANGUAGES,
  FLASHCARD_FORMATS,
  FLASHCARD_MATERIAL_TYPES,
  type FlashcardFormat,
  type FlashcardMaterialType,
} from '@flashly/shared/src';
import { FlashcardFormatSelector } from '@/features/flashcards/components/flashcard-format-selector';

const deckMetadataSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  description: z.string().max(1000, 'Description is too long').optional(),
  materialType: z.string().optional(),
  deckType: z.string().optional(),
  locale: z.string().optional(),
  accentKey: z.string().optional(),
});

type DeckMetadataFormValues = z.infer<typeof deckMetadataSchema>;

export function DeckMetadataForm({
  deck,
  onUpdate,
  onSave,
  isSaving = false,
  hasChanges = false,
  disabled = false,
}: DeckMetadataFormProps) {
  const { t } = useTranslation();
  const defaultMaterialType = FLASHCARD_MATERIAL_TYPES[0];
  const defaultFormat = FLASHCARD_FORMATS[0];

  const form = useForm<DeckMetadataFormValues>({
    resolver: zodResolver(deckMetadataSchema),
    defaultValues: {
      name: deck.name,
      description: deck.description || '',
      materialType: deck.materialType || '',
      deckType: deck.deckType || '',
      locale: deck.locale || '',
      accentKey: deck.accentKey || getAccentKeyForMaterialType(deck.materialType),
    },
  });

  const watchedMaterialType = useWatch({ control: form.control, name: 'materialType' });
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      const derived = getAccentKeyForMaterialType(watchedMaterialType);
      if (form.getValues('accentKey') !== derived) {
        form.setValue('accentKey', derived, { shouldDirty: false });
      }
      return;
    }

    const derived = getAccentKeyForMaterialType(watchedMaterialType);
    if (form.getValues('accentKey') !== derived) {
      form.setValue('accentKey', derived, { shouldDirty: true });
    }
  }, [watchedMaterialType, form]);

  // Watch for changes and notify parent
  React.useEffect(() => {
    const subscription = form.watch((values) => {
      onUpdate(values);
    });
    return () => subscription.unsubscribe();
  }, [form, onUpdate]);

  const handleSubmit = () => {
    onSave();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('decks.metadata.title')}</h2>
        {hasChanges && (
          <Button size="sm" onClick={form.handleSubmit(() => onSave())} disabled={isSaving || disabled}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.save')}
          </Button>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('decks.name')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('decks.namePlaceholder')} {...field} disabled={disabled} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('decks.description')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t('decks.descriptionPlaceholder')}
                    className="resize-none"
                    rows={4}
                    {...field}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="materialType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('decks.materialType')}</FormLabel>
                  <FormControl>
                    <MaterialTypeCombobox
                      id="deck-material-type"
                      value={(field.value || defaultMaterialType) as FlashcardMaterialType}
                      onChange={(value) => field.onChange(value)}
                      disabled={disabled}
                      portalled={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="locale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('web.flashcards.cardLanguage')}</FormLabel>
                  <FormControl>
                    <LanguageCombobox
                      id="deck-locale"
                      value={field.value || undefined}
                      onChange={(value) => field.onChange(value ?? '')}
                      languages={ELEVENLABS_V3_LANGUAGES}
                      placeholder={t('web.flashcards.cardLanguagePlaceholder')}
                      disabled={disabled}
                      portalled={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="deckType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('decks.deckType')}</FormLabel>
                <FormControl>
                  <FlashcardFormatSelector
                    value={(field.value || defaultFormat) as FlashcardFormat}
                    onChange={(value) => field.onChange(value)}
                    disabled={disabled}
                    size="compact"
                    showDescription={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        </form>
      </Form>
    </div>
  );
}
