/**
 * CreateDeckDialog - Dialog for creating a new deck
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { defaultLocale } from '@/i18n';
import { Loader2 } from 'lucide-react';
import type { CreateDeckDialogProps } from '../types/deck.types';
import {
  ELEVENLABS_V3_LANGUAGES,
  FLASHCARD_FORMATS,
  FLASHCARD_MATERIAL_TYPES,
  type FlashcardFormat,
  type FlashcardMaterialType,
} from '@flashly/shared/src';
import { FlashcardFormatSelector } from '@/features/flashcards/components/flashcard-format-selector';
import { getAccentKeyForMaterialType } from '@/utils/deck-accent';

const createDeckSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  description: z.string().max(1000, 'Description is too long').optional(),
  accentKey: z.string().optional(),
  materialType: z.string().optional(),
  deckType: z.string().optional(),
  locale: z.string().optional(),
});

type CreateDeckFormValues = z.infer<typeof createDeckSchema>;

export function CreateDeckDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateDeckDialogProps) {
  const { t, i18n } = useTranslation();
  const defaultFormat = FLASHCARD_FORMATS[0];
  const defaultMaterialType = FLASHCARD_MATERIAL_TYPES[0];
  const resolvedLocale = React.useMemo(() => {
    const activeLocale = i18n.language ?? defaultLocale;
    return ELEVENLABS_V3_LANGUAGES.some((language) => language.code === activeLocale)
      ? activeLocale
      : defaultLocale;
  }, [i18n.language]);
  const { mutate, isLoading, error } = useCreateDeck({
    onSuccess: (deck) => {
      onSuccess({
        ...deck,
        cardCount: 0,
      });
      onOpenChange(false);
      form.reset();
    },
  });

  const form = useForm<CreateDeckFormValues>({
    resolver: zodResolver(createDeckSchema),
    defaultValues: {
      name: '',
      description: '',
      accentKey: getAccentKeyForMaterialType(defaultMaterialType),
      materialType: defaultMaterialType,
      deckType: defaultFormat,
      locale: resolvedLocale,
    },
  });

  const onSubmit = (values: CreateDeckFormValues) => {
    mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('decks.create.title')}</DialogTitle>
          <DialogDescription>{t('decks.create.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('decks.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('decks.namePlaceholder')} {...field} />
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
                      rows={3}
                      {...field}
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
                        onChange={(value) => {
                          field.onChange(value);
                          form.setValue('accentKey', getAccentKeyForMaterialType(value), { shouldDirty: true });
                        }}
                        portalled={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        size="compact"
                        showDescription={false}
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
                        portalled={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {error && (
              <div className="text-sm text-destructive">
                {error.message || t('decks.create.error')}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('decks.create.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Import hook at top to avoid circular dependency
import { useCreateDeck } from '../hooks/use-create-deck';
