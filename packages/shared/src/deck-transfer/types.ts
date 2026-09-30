import type { QuizEnrichment } from '../quiz-enrichment';

export const DECK_TRANSFER_FORMAT_IDS = [
  'anki-csv',
  'quizlet-txt',
] as const;

export type DeckTransferFormatId = (typeof DECK_TRANSFER_FORMAT_IDS)[number];

export interface DeckTransferDeck {
  name: string;
  description?: string | null;
  materialType?: string | null;
  deckType?: string | null;
  locale?: string | null;
  accentKey?: string | null;
}

export interface DeckTransferCard {
  front: string;
  back: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  category?: string | null;
  pos?: string | null;
  gender?: string | null;
  example?: string | null;
  tags?: string | null;
  quiz?: QuizEnrichment;
}

export interface DeckTransferPayload {
  deck: DeckTransferDeck;
  cards: DeckTransferCard[];
}

export interface DeckTransferImportOptions {
  deckName?: string;
}

export interface DeckTransferExportOptions {
  includeMetadataInDefinitions?: boolean;
}

export interface DeckTransferFormatAdapter {
  readonly id: DeckTransferFormatId;
  readonly label: string;
  readonly extension: string;
  readonly mimeType: string;
  importFromText: (
    input: string,
    options?: DeckTransferImportOptions
  ) => DeckTransferPayload;
  exportToText: (
    payload: DeckTransferPayload,
    options?: DeckTransferExportOptions
  ) => string;
}

export interface DeckTransferFormatDescriptor {
  id: DeckTransferFormatId;
  label: string;
  extension: string;
  mimeType: string;
}
