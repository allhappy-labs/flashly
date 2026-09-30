import type { Card } from '@/types/api.types';
import type { CardFieldSuggestions } from '../types/card-field-suggestions';

function normalizeValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseTagTokens(value: string | null | undefined): string[] {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/[;,]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function sortCaseInsensitive(values: Iterable<string>): string[] {
  return Array.from(values).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' }),
  );
}

export function collectCardFieldSuggestions(cards: readonly Card[]): CardFieldSuggestions {
  const categories = new Set<string>();
  const pos = new Set<string>();
  const genders = new Set<string>();
  const tags = new Set<string>();

  for (const card of cards) {
    const category = normalizeValue(card.category);
    if (category) {
      categories.add(category);
    }

    const partOfSpeech = normalizeValue(card.pos);
    if (partOfSpeech) {
      pos.add(partOfSpeech);
    }

    const gender = normalizeValue(card.gender);
    if (gender) {
      genders.add(gender);
    }

    for (const tag of parseTagTokens(card.tags)) {
      tags.add(tag);
    }
  }

  return {
    categories: sortCaseInsensitive(categories),
    pos: sortCaseInsensitive(pos),
    genders: sortCaseInsensitive(genders),
    tags: sortCaseInsensitive(tags),
  };
}

