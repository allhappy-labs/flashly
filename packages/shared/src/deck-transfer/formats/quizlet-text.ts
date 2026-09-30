import type { DeckTransferCard, DeckTransferFormatAdapter } from '../types';

const QUIZLET_META_PREFIX = '[flashly-meta:';

export const quizletTxtFormatAdapter: DeckTransferFormatAdapter = {
  id: 'quizlet-txt',
  label: 'Quizlet Text',
  extension: 'txt',
  mimeType: 'text/plain',
  importFromText: (input, options) => {
    const rawRows = normalizeRows(input);
    const cards: DeckTransferCard[] = [];

    for (const rawRow of rawRows) {
      const parsedRow = splitQuizletRow(rawRow);
      if (!parsedRow) {
        continue;
      }

      const front = sanitizeInlineText(parsedRow.front);
      const definition = sanitizeInlineText(parsedRow.definition);
      if (!front || !definition) {
        continue;
      }

      const meta = parseQuizletMeta(definition);
      const back = meta.cleanedDefinition;

      cards.push({
        front,
        back,
        imageUrl: meta.meta.imageUrl ?? null,
        audioUrl: meta.meta.audioUrl ?? null,
        category: meta.meta.category ?? null,
        pos: meta.meta.pos ?? null,
        gender: meta.meta.gender ?? null,
        example: meta.meta.example ?? null,
        tags: meta.meta.tags ?? null,
      });
    }

    if (cards.length === 0) {
      throw new Error('Quizlet content must include at least one valid term-definition pair');
    }

    const deckName = options?.deckName?.trim();

    return {
      deck: {
        name: deckName && deckName.length > 0 ? deckName : 'Imported Quizlet set',
      },
      cards,
    };
  },
  exportToText: (payload, options) =>
    payload.cards
      .map((card) => {
        const front = sanitizeInlineText(card.front);
        const back = sanitizeInlineText(card.back);
        if (!front || !back) {
          return null;
        }
        const definition = buildQuizletDefinition(card, options?.includeMetadataInDefinitions ?? true);
        return `${front}\t${definition}`;
      })
      .filter((row): row is string => Boolean(row))
      .join('\n'),
};

function normalizeRows(input: string): string[] {
  const normalized = input.replaceAll('\r\n', '\n').trim();
  if (!normalized) {
    return [];
  }
  if (normalized.includes('\n')) {
    return normalized.split('\n').map((row) => row.trim()).filter(Boolean);
  }
  return normalized
    .split(';')
    .map((row) => row.trim())
    .filter(Boolean);
}

function splitQuizletRow(row: string): { front: string; definition: string } | null {
  const tabIndex = row.indexOf('\t');
  if (tabIndex >= 0) {
    return {
      front: row.slice(0, tabIndex),
      definition: row.slice(tabIndex + 1),
    };
  }

  const commaIndex = row.indexOf(',');
  if (commaIndex >= 0) {
    return {
      front: row.slice(0, commaIndex),
      definition: row.slice(commaIndex + 1),
    };
  }

  const spacedDashIndex = row.indexOf(' - ');
  if (spacedDashIndex >= 0) {
    return {
      front: row.slice(0, spacedDashIndex),
      definition: row.slice(spacedDashIndex + 3),
    };
  }

  return null;
}

function sanitizeInlineText(value: string): string {
  return value
    .replaceAll('\t', ' ')
    .replaceAll('\n', ' ')
    .replaceAll('\r', ' ')
    .trim();
}

function buildQuizletDefinition(card: DeckTransferCard, includeMetadata: boolean): string {
  const baseDefinition = sanitizeInlineText(card.back);
  if (!includeMetadata) {
    return baseDefinition;
  }

  const meta: Record<string, string> = {};
  if (card.category?.trim()) meta.category = card.category.trim();
  if (card.pos?.trim()) meta.pos = card.pos.trim();
  if (card.gender?.trim()) meta.gender = card.gender.trim();
  if (card.example?.trim()) meta.example = sanitizeInlineText(card.example);
  if (card.tags?.trim()) meta.tags = card.tags.trim();
  if (card.imageUrl?.trim()) meta.imageUrl = card.imageUrl.trim();
  if (card.audioUrl?.trim()) meta.audioUrl = card.audioUrl.trim();

  if (Object.keys(meta).length === 0) {
    return baseDefinition;
  }

  return `${baseDefinition} ${QUIZLET_META_PREFIX}${JSON.stringify(meta)}]`;
}

function parseQuizletMeta(definition: string): {
  cleanedDefinition: string;
  meta: Record<string, string>;
} {
  const markerIndex = definition.lastIndexOf(QUIZLET_META_PREFIX);
  if (markerIndex < 0) {
    return {
      cleanedDefinition: definition,
      meta: {},
    };
  }

  const prefix = definition.slice(0, markerIndex).trimEnd();
  const candidate = definition.slice(markerIndex + QUIZLET_META_PREFIX.length);
  if (!candidate.endsWith(']')) {
    return {
      cleanedDefinition: definition,
      meta: {},
    };
  }

  const jsonPayload = candidate.slice(0, -1).trim();
  try {
    const parsed = JSON.parse(jsonPayload) as Record<string, unknown>;
    const normalizedEntries = Object.entries(parsed).flatMap(([key, value]) => {
      if (typeof value !== 'string') {
        return [];
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? [[key, trimmed] as const] : [];
    });

    return {
      cleanedDefinition: prefix.length > 0 ? prefix : definition,
      meta: Object.fromEntries(normalizedEntries),
    };
  } catch {
    return {
      cleanedDefinition: definition,
      meta: {},
    };
  }
}

