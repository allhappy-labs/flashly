/**
 * AddCardDialog - Dialog for adding a new card
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { ImageUploadButton } from './image-upload-button';
import { AudioUploadButton } from './audio-upload-button';
import { AutocompleteTextInput } from './autocomplete-text-input';
import type { CardFieldSuggestions } from '../types/card-field-suggestions';

const createCardSchema = z.object({
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

type CreateCardFormValues = z.infer<typeof createCardSchema>;

export interface AddCardDialogProps {
  deckId: string;
  onAdd: (input: Omit<CreateCardFormValues, 'imageUrl' | 'audioUrl'> & { imageUrl?: string; audioUrl?: string }) => void;
  isAdding?: boolean;
  fieldSuggestions?: CardFieldSuggestions;
}

const EMPTY_FIELD_SUGGESTIONS: CardFieldSuggestions = {
  categories: [],
  pos: [],
  genders: [],
  tags: [],
};

export function AddCardDialog({
  onAdd,
  isAdding = false,
  fieldSuggestions = EMPTY_FIELD_SUGGESTIONS,
}: AddCardDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const form = useForm<CreateCardFormValues>({
    resolver: zodResolver(createCardSchema),
    defaultValues: {
      front: '',
      back: '',
      imageUrl: '',
      audioUrl: '',
      category: '',
      pos: '',
      gender: '',
      example: '',
      tags: '',
    },
  });

  const onSubmit = (values: CreateCardFormValues) => {
    const { imageUrl, audioUrl, ...rest } = values;
    onAdd({
      ...rest,
      imageUrl: imageUrl || undefined,
      audioUrl: audioUrl || undefined,
    });
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('decks.cards.add')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{t('decks.cards.addTitle')}</DialogTitle>
          <DialogDescription>{t('decks.cards.addDescription')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-col">
            <div className="max-h-[calc(90vh-9.5rem)] overflow-y-auto px-6 pb-4">
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
                            disabled={isAdding}
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
                            disabled={isAdding}
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
                            disabled={isAdding}
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
                            disabled={isAdding}
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
                          disabled={isAdding}
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
                          disabled={isAdding}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isAdding}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isAdding}>
                {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('decks.cards.add')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
