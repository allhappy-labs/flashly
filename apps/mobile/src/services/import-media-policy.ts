import type { ParsedCard } from '../types/models';
import { usableMediaUri } from '../utils/media-policy';
import { sanitizeMarkdownImageTargets } from '../utils/markdown-media-sanitizer';

export function sanitizeImportedCardMedia(card: ParsedCard, allowRemote: boolean): ParsedCard {
  return {
    ...card,
    front: sanitizeMarkdownImageTargets(card.front, allowRemote),
    back: sanitizeMarkdownImageTargets(card.back, allowRemote),
    imageUrl: usableMediaUri(card.imageUrl, allowRemote) ?? undefined,
    audioUrl: usableMediaUri(card.audioUrl, allowRemote) ?? undefined,
  };
}
