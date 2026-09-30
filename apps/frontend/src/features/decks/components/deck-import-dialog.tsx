import * as React from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DeckTransferFormatId } from '@flashly/shared';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DeckZipError, readDeckZipFile, type DeckZipParseResult } from '@/utils/deck-zip';
import { useDeckTransfer } from '../hooks/use-deck-transfer';

export interface DeckImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: (deckId: string) => void;
}

type DeckImportFormatId = 'flashly' | DeckTransferFormatId;

const IMPORT_ACCEPT_BY_FORMAT: Record<DeckImportFormatId, string> = {
  flashly: '.flashly,application/zip,application/octet-stream',
  'anki-csv': '.csv,text/csv',
  'quizlet-txt': '.txt,text/plain,.csv,text/csv',
};

export function DeckImportDialog(props: Readonly<DeckImportDialogProps>) {
  const { t } = useTranslation();
  const { importDeck, isImporting } = useDeckTransfer();

  const [format, setFormat] = React.useState<DeckImportFormatId>('flashly');
  const [file, setFile] = React.useState<File | null>(null);
  const [deckName, setDeckName] = React.useState('');

  const resetForm = React.useCallback(() => {
    setFormat('flashly');
    setFile(null);
    setDeckName('');
  }, []);

  const handleSubmit = React.useCallback(async () => {
    if (!file) {
      toast.error(t('decks.transfer.import.fileRequired'));
      return;
    }

    if (format === 'flashly') {
      try {
        const parsed = await readDeckZipFile(file, { requireLocale: false });
        const result = await importDeck({
          formatId: 'flashly',
          payload: buildFlashlyImportPayload(parsed, deckName, t('import.defaultDeckName')),
        });

        if (!result.success) {
          toast.error(result.error.message || t('decks.transfer.import.error'));
          return;
        }

        toast.success(t('decks.transfer.import.success', { count: result.data.cardCount }));
        props.onOpenChange(false);
        resetForm();
        props.onImportSuccess?.(result.data.deckId);
      } catch (error) {
        toast.error(getFlashlyImportErrorMessage(error, t));
      }
      return;
    }

    const fileContent = await file.text();
    const result = await importDeck({
      formatId: format,
      fileContent,
      deckName: deckName.trim() || undefined,
    });

    if (!result.success) {
      toast.error(result.error.message || t('decks.transfer.import.error'));
      return;
    }

    toast.success(t('decks.transfer.import.success', { count: result.data.cardCount }));
    props.onOpenChange(false);
    resetForm();
    props.onImportSuccess?.(result.data.deckId);
  }, [deckName, file, format, importDeck, props, resetForm, t]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t('decks.import.title')}
          </DialogTitle>
          <DialogDescription>{t('decks.import.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('decks.transfer.import.format')}</Label>
            <Select value={format} onValueChange={(value) => setFormat(value as DeckImportFormatId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flashly">.flashly</SelectItem>
                <SelectItem value="anki-csv">{t('decks.transfer.formats.ankiCsv')}</SelectItem>
                <SelectItem value="quizlet-txt">{t('decks.transfer.formats.quizletTxt')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('decks.transfer.import.file')}</Label>
            <Input
              type="file"
              accept={IMPORT_ACCEPT_BY_FORMAT[format]}
              disabled={isImporting}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('decks.transfer.import.deckName')}</Label>
            <Input
              value={deckName}
              onChange={(event) => setDeckName(event.target.value)}
              placeholder={t('decks.transfer.import.deckNamePlaceholder')}
              disabled={isImporting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isImporting}>
            {isImporting ? t('decks.transfer.import.processing') : t('decks.transfer.import.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildFlashlyImportPayload(
  parsed: DeckZipParseResult,
  overrideDeckName: string,
  defaultDeckName: string,
) {
  const parsedDeck = parsed.config?.deck;
  const deckName =
    overrideDeckName.trim()
    || parsedDeck?.name?.trim()
    || parsed.fileName.replace(/\.flashly$/i, '').trim()
    || defaultDeckName;

  return {
    deck: {
      name: deckName,
      description: parsedDeck?.description ?? undefined,
      materialType: parsedDeck?.materialType ?? undefined,
      deckType: parsedDeck?.deckType ?? undefined,
      locale: parsedDeck?.locale ?? undefined,
      accentKey: undefined,
    },
    cards: parsed.cards.map((card) => ({
      front: card.front,
      back: card.back,
      imageUrl: typeof card.imageUrl === 'string' ? card.imageUrl : undefined,
      audioUrl: typeof card.audioUrl === 'string' ? card.audioUrl : undefined,
      category: typeof card.category === 'string' ? card.category : undefined,
      pos: typeof card.pos === 'string' ? card.pos : undefined,
      gender: typeof card.gender === 'string' ? card.gender : undefined,
      example: serializeExample(card.example),
      tags: Array.isArray(card.tags) ? card.tags.join(', ') : undefined,
    })),
  };
}

function serializeExample(example: unknown): string | undefined {
  if (!example) {
    return undefined;
  }
  if (typeof example === 'string') {
    return example;
  }
  try {
    return JSON.stringify(example);
  } catch {
    return undefined;
  }
}

function getFlashlyImportErrorMessage(error: unknown, t: (key: string) => string): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: string }).code)
    : null;

  switch (code) {
    case DeckZipError.UNSUPPORTED_FORMAT:
      return `${t('web.flashcards.deckImport.unsupportedFormat')} ${t('web.flashcards.deckImport.unsupportedFormatHint')}`;
    case DeckZipError.MISSING_DECK_JSONL:
      return t('web.flashcards.deckImport.missingDeckJsonl');
    case DeckZipError.MISSING_CONFIG:
      return t('web.flashcards.deckImport.missingConfig');
    case DeckZipError.INVALID_LOCALE:
      return t('web.flashcards.deckImport.missingLocale');
    case DeckZipError.NO_CARDS:
      return t('web.flashcards.deckImport.noCardsFound');
    default:
      return t('web.flashcards.deckImport.parseError');
  }
}
