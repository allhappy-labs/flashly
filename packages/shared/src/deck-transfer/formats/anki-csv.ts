import { buildDelimitedText, findColumnIndex, parseDelimitedText } from '../csv';
import type { DeckTransferFormatAdapter } from '../types';

const ANKI_CSV_HEADERS = [
  'Deck',
  'Front',
  'Back',
  'Image URL',
  'Audio URL',
  'Category',
  'Part of Speech',
  'Gender',
  'Example',
  'Tags',
];

export const ankiCsvFormatAdapter: DeckTransferFormatAdapter = {
  id: 'anki-csv',
  label: 'Anki CSV',
  extension: 'csv',
  mimeType: 'text/csv',
  importFromText: (input, options) => {
    const delimiter = detectAnkiDelimiter(input);
    const rows = parseDelimitedText(input, delimiter).filter((row) => {
      const firstCell = String(row[0] ?? '').trim();
      return !firstCell.startsWith('#');
    });

    if (rows.length === 0) {
      throw new Error('Anki CSV file is empty');
    }

    const [firstRow, ...remainingRows] = rows;
    const frontIndexFromHeader = findColumnIndex(firstRow, ['front', 'term', 'question']);
    const backIndexFromHeader = findColumnIndex(firstRow, ['back', 'definition', 'answer']);
    const hasHeader = frontIndexFromHeader >= 0 && backIndexFromHeader >= 0;

    const dataRows = hasHeader ? remainingRows : rows;
    const headers = hasHeader ? firstRow : [];

    const deckNameIndex = hasHeader ? findColumnIndex(headers, ['deck']) : -1;
    const frontIndex = hasHeader ? frontIndexFromHeader : 0;
    const backIndex = hasHeader ? backIndexFromHeader : 1;
    const imageUrlIndex = hasHeader ? findColumnIndex(headers, ['image url', 'image']) : -1;
    const audioUrlIndex = hasHeader ? findColumnIndex(headers, ['audio url', 'audio']) : -1;
    const categoryIndex = hasHeader ? findColumnIndex(headers, ['category']) : -1;
    const posIndex = hasHeader ? findColumnIndex(headers, ['part of speech', 'pos']) : -1;
    const genderIndex = hasHeader ? findColumnIndex(headers, ['gender']) : -1;
    const exampleIndex = hasHeader ? findColumnIndex(headers, ['example']) : -1;
    const tagsIndex = hasHeader ? findColumnIndex(headers, ['tags']) : -1;

    const firstDeckNameInRows = dataRows
      .map((row) => toOptionalString(row[deckNameIndex]))
      .find((candidate) => candidate && candidate.length > 0);

    const cards = dataRows
      .map((row) => ({
        front: String(row[frontIndex] ?? '').trim(),
        back: String(row[backIndex] ?? '').trim(),
        imageUrl: toOptionalString(row[imageUrlIndex]),
        audioUrl: toOptionalString(row[audioUrlIndex]),
        category: toOptionalString(row[categoryIndex]),
        pos: toOptionalString(row[posIndex]),
        gender: toOptionalString(row[genderIndex]),
        example: toOptionalString(row[exampleIndex]),
        tags: toOptionalString(row[tagsIndex]),
      }))
      .filter((card) => card.front.length > 0 && card.back.length > 0);

    if (cards.length === 0) {
      throw new Error('Anki CSV must include at least one valid card');
    }

    return {
      deck: {
        name: resolveDeckName(options?.deckName, firstDeckNameInRows),
      },
      cards,
    };
  },
  exportToText: (payload) => {
    const rows = [
      ANKI_CSV_HEADERS,
      ...payload.cards.map((card) => [
        payload.deck.name,
        card.front,
        card.back,
        card.imageUrl ?? '',
        card.audioUrl ?? '',
        card.category ?? '',
        card.pos ?? '',
        card.gender ?? '',
        card.example ?? '',
        card.tags ?? '',
      ]),
    ];

    return buildDelimitedText(rows, ',');
  },
};

function resolveDeckName(deckName?: string, fallbackDeckName?: string | null): string {
  const explicit = deckName?.trim();
  if (explicit && explicit.length > 0) {
    return explicit;
  }
  const fallback = fallbackDeckName?.trim();
  if (fallback && fallback.length > 0) {
    return fallback;
  }
  return 'Imported Anki deck';
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function detectAnkiDelimiter(input: string): string {
  const lines = input
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const separatorHeader = lines.find((line) => line.startsWith('#separator:'));
  if (separatorHeader) {
    const rawValue = separatorHeader.slice('#separator:'.length).trim().toLowerCase();
    const literalMap: Record<string, string> = {
      comma: ',',
      semicolon: ';',
      tab: '\t',
      pipe: '|',
      colon: ':',
      space: ' ',
    };
    if (literalMap[rawValue]) {
      return literalMap[rawValue];
    }
    if (rawValue.length === 1) {
      return rawValue;
    }
  }

  const firstDataLine = lines.find((line) => !line.startsWith('#'));
  if (!firstDataLine) {
    return ',';
  }

  const candidates = [',', ';', '\t', '|'];
  const best = candidates.reduce(
    (current, candidate) => {
      const count = firstDataLine.split(candidate).length - 1;
      if (count > current.count) {
        return { delimiter: candidate, count };
      }
      return current;
    },
    { delimiter: ',', count: 0 }
  );

  return best.delimiter;
}
