import { ankiCsvFormatAdapter } from './formats/anki-csv';
import { quizletTxtFormatAdapter } from './formats/quizlet-text';
import type {
  DeckTransferFormatAdapter,
  DeckTransferFormatDescriptor,
  DeckTransferFormatId,
} from './types';

const deckTransferAdapters: Record<DeckTransferFormatId, DeckTransferFormatAdapter> = {
  'anki-csv': ankiCsvFormatAdapter,
  'quizlet-txt': quizletTxtFormatAdapter,
};

export function getDeckTransferFormatAdapter(formatId: DeckTransferFormatId): DeckTransferFormatAdapter {
  const adapter = deckTransferAdapters[formatId];
  if (!adapter) {
    throw new Error(`Unsupported deck transfer format: ${formatId}`);
  }
  return adapter;
}

export function listDeckTransferFormats(): DeckTransferFormatDescriptor[] {
  return Object.values(deckTransferAdapters).map((adapter) => ({
    id: adapter.id,
    label: adapter.label,
    extension: adapter.extension,
    mimeType: adapter.mimeType,
  }));
}
