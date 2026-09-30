/**
 * Create From Template Dialog - Dialog for creating a deck from a template
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

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
import type { Template } from '../types/template.types';
import { getApiClient } from '@/lib/api/client';

const createFromTemplateSchema = z.object({
  name: z.string().min(1, 'Deck name is required').max(200, 'Deck name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
});

type CreateFromTemplateFormValues = z.infer<typeof createFromTemplateSchema>;

export interface CreateFromTemplateDialogProps {
  template: Template;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeckCreated: (deckId: string) => void;
}

export function CreateFromTemplateDialog({
  template,
  open,
  onOpenChange,
  onDeckCreated,
}: CreateFromTemplateDialogProps) {
  const { t } = useTranslation();

  const form = useForm<CreateFromTemplateFormValues>({
    resolver: zodResolver(createFromTemplateSchema),
    defaultValues: {
      name: `${template.name} - Copy`,
      description: template.description || '',
    },
  });

  const [isCreating, setIsCreating] = React.useState(false);

  const handleSubmit = async (values: CreateFromTemplateFormValues) => {
    setIsCreating(true);

    try {
      const api = getApiClient();
      if (!api) {
        throw new Error('API client not initialized');
      }

      const result = await api.post<{ id: string }>(`/api/decks/from-template/${template.id}`, values);
      const deck = result.match(
        (data) => data,
        (error) => {
          throw new Error(error.message || 'Failed to create deck from template');
        }
      );
      onDeckCreated(deck.id);
    } catch (error) {
      console.error('Error creating deck from template:', error);
      // Handle error
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('templates.createFrom.title')}</DialogTitle>
          <DialogDescription>
            {t('templates.createFrom.description', { templateName: template.name })}
          </DialogDescription>
        </DialogHeader>

        {/* Template Info */}
        <div className="mb-4 p-3 bg-muted rounded space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{template.name}</span>
            <span className="text-muted-foreground">{template.cardCount} cards</span>
          </div>
          {template.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {template.description}
            </p>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('templates.createFrom.deckName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('templates.createFrom.deckNamePlaceholder')} {...field} />
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
                  <FormLabel>{t('templates.createFrom.descriptionLabel')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('templates.createFrom.descriptionPlaceholder')}
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('templates.createFrom.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
