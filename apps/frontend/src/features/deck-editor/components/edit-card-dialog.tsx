/**
 * EditCardDialog - Dialog for editing an existing card
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { CardPreview } from './card-preview';
import { ImageUploadButton } from './image-upload-button';
import { AudioUploadButton } from './audio-upload-button';
import { AutocompleteTextInput } from './autocomplete-text-input';
import type { Card } from '@/types/api.types';
import type { CardFieldSuggestions } from '../types/card-field-suggestions';

const updateCardSchema = z.object({
  front: z.string().min(1, 'Front is required').max(2000, 'Front is too long'),
  back: z.string().min(1, 'Back is required').max(2000, 'Back is too long'),
  imageUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  category: z.string().optional(),
  pos: z.string().optional(),
  gender: z.string().optional(),
  example: z.string().optional(),
  tags: z.string().optional(),
});

type UpdateCardFormValues = z.infer<typeof updateCardSchema>;

export interface EditCardDialogProps {
  card: Card | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (input: UpdateCardFormValues) => void;
  isUpdating?: boolean;
  fieldSuggestions?: CardFieldSuggestions;
}

const EMPTY_FIELD_SUGGESTIONS: CardFieldSuggestions = {
  categories: [],
  pos: [],
  genders: [],
  tags: [],
};

export function EditCardDialog({
  card,
  open,
  onOpenChange,
  onUpdate,
  isUpdating = false,
  fieldSuggestions = EMPTY_FIELD_SUGGESTIONS,
}: EditCardDialogProps) {
  const { t } = useTranslation();

  const form = useForm<UpdateCardFormValues>({
    resolver: zodResolver(updateCardSchema),
    defaultValues: {
      front: card?.front || '',
      back: card?.back || '',
      imageUrl: card?.imageUrl || '',
      audioUrl: card?.audioUrl || '',
      category: card?.category || '',
      pos: card?.pos || '',
      gender: card?.gender || '',
      example: card?.example || '',
      tags: card?.tags || '',
    },
  });

  // Update form values when card changes
  React.useEffect(() => {
    if (card) {
      form.reset({
        front: card.front,
        back: card.back,
        imageUrl: card.imageUrl || '',
        audioUrl: card.audioUrl || '',
        category: card.category || '',
        pos: card.pos || '',
        gender: card.gender || '',
        example: card.example || '',
        tags: card.tags || '',
      });
    }
  }, [card, form]);

  const onSubmit = (values: UpdateCardFormValues) => {
    const { imageUrl, audioUrl, ...rest } = values;
    onUpdate({
      ...rest,
      imageUrl: imageUrl || undefined,
      audioUrl: audioUrl || undefined,
    });
  };

  const watchedValues = form.watch();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{t('decks.cards.edit.title')}</DialogTitle>
          <DialogDescription>{t('decks.cards.edit.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          {/* Form Section */}
          <div className="min-h-0 border-b lg:border-b-0 lg:border-r">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-col">
                <div className="max-h-[calc(90vh-10rem)] overflow-y-auto px-6 pb-4">
                  <div className="-mx-1 space-y-4 px-1">
                    <FormField
                      control={form.control}
                      name="front"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('decks.cards.front')}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t('decks.cards.frontPlaceholder')}
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="back"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('decks.cards.back')}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t('decks.cards.backPlaceholder')}
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('decks.cards.category')}</FormLabel>
                            <FormControl>
                              <AutocompleteTextInput
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                placeholder={t('decks.cards.categoryPlaceholder')}
                                suggestions={fieldSuggestions.categories}
                                disabled={isUpdating}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="pos"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('decks.cards.pos')}</FormLabel>
                            <FormControl>
                              <AutocompleteTextInput
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                placeholder={t('decks.cards.posPlaceholder')}
                                suggestions={fieldSuggestions.pos}
                                disabled={isUpdating}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('decks.cards.gender')}</FormLabel>
                            <FormControl>
                              <AutocompleteTextInput
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                placeholder={t('decks.cards.genderPlaceholder')}
                                suggestions={fieldSuggestions.genders}
                                disabled={isUpdating}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="tags"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('decks.cards.tags')}</FormLabel>
                            <FormControl>
                              <AutocompleteTextInput
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                placeholder={t('decks.cards.tagsPlaceholder')}
                                suggestions={fieldSuggestions.tags}
                                disabled={isUpdating}
                                multipleTokens
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="example"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('decks.cards.example')}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t('decks.cards.examplePlaceholder')}
                              className="resize-none"
                              rows={2}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('decks.cards.imageUrl')}</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input placeholder="https://..." {...field} />
                            </FormControl>
                            <ImageUploadButton
                              onUploadComplete={(url) => field.onChange(url)}
                              currentUrl={field.value}
                              disabled={isUpdating}
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="audioUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('decks.cards.audioUrl')}</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input placeholder="https://..." {...field} />
                            </FormControl>
                            <AudioUploadButton
                              onUploadComplete={(url) => field.onChange(url)}
                              currentUrl={field.value}
                              disabled={isUpdating}
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 border-t px-6 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isUpdating}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('decks.cards.edit.save')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>

          {/* Preview Section */}
          <div className="min-h-0 px-6 py-4 lg:py-6">
            <div className="space-y-4 lg:sticky lg:top-0">
              <h3 className="text-sm font-medium text-muted-foreground">Preview</h3>
              <CardPreview
                front={watchedValues.front || card?.front || ''}
                back={watchedValues.back || card?.back || ''}
                category={watchedValues.category || card?.category}
                pos={watchedValues.pos || card?.pos}
                gender={watchedValues.gender || card?.gender}
                imageUrl={watchedValues.imageUrl || card?.imageUrl}
                audioUrl={watchedValues.audioUrl || card?.audioUrl}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
