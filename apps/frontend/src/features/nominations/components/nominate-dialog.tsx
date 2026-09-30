/**
 * Nominate Dialog - Dialog for nominating a deck for featuring
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Star, Loader2 } from 'lucide-react';

import { nominateDeck } from '@/lib/api/deck-service';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const nominationSchema = z.object({
  reason: z
    .string()
    .min(10, 'Please provide at least 10 characters explaining why this deck should be featured')
    .max(500, 'Reason is too long (max 500 characters)'),
});

type NominationFormValues = z.infer<typeof nominationSchema>;

export interface NominateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  deckName: string;
}

export function NominateDialog({ open, onOpenChange, deckId, deckName }: NominateDialogProps) {
  const { t } = useTranslation();
  const form = useForm<NominationFormValues>({
    resolver: zodResolver(nominationSchema),
    defaultValues: {
      reason: '',
    },
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (values: NominationFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await nominateDeck(deckId, values);
      result.match(
        () => {
          toast.success(t('nominations.success'));
          onOpenChange(false);
          form.reset();
        },
        (requestError) => {
          toast.error(requestError.message || t('nominations.error'));
        }
      );
    } catch {
      toast.error(t('nominations.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            {t('nominations.title')}
          </DialogTitle>
          <DialogDescription>{t('nominations.description', { deckName })}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('nominations.reason.label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('nominations.reason.placeholder')}
                      className="resize-none"
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('nominations.reason.hint')}
                  </p>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('nominations.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
