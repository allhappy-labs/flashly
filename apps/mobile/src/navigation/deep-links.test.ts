import { describe, expect, it } from 'vitest';
import {
  isAuthDeepLink,
  isImportFileLink,
  parseAuthDeepLink,
  resolveDeckDeepLink,
} from './deep-links';

describe('deep-links', () => {
  describe('isImportFileLink', () => {
    it('accepts Flashly archives from files and opaque Android content providers', () => {
      expect(isImportFileLink('file:///tmp/test.flashly')).toBe(true);
      expect(isImportFileLink('content://documents/my-deck.flashly')).toBe(true);
      expect(isImportFileLink('content://com.android.providers.downloads.documents/document/8127')).toBe(true);
      expect(isImportFileLink('file:///tmp/test.FLASHLY?download=1')).toBe(true);
    });

    it('keeps file routes extension-specific', () => {
      expect(isImportFileLink('file:///tmp/notes.txt')).toBe(false);
    });

    it('ignores non-import links', () => {
      expect(isImportFileLink('flashly://decks/abc')).toBe(false);
      expect(isImportFileLink('https://example.test/Deck.flashly')).toBe(false);
    });
  });

  describe('auth deep links', () => {
    it('detects auth deep link and parses tokens', () => {
      const url = 'flashly://auth?token=abc123&ott=xyz';
      expect(isAuthDeepLink(url)).toBe(true);
      expect(parseAuthDeepLink(url)).toEqual({
        token: 'abc123',
        ott: 'xyz',
        error: null,
        errorDescription: null,
      });
    });

    it('parses fallback error description keys', () => {
      const url = 'flashly://auth?error=access_denied&message=Link%20expired';
      expect(parseAuthDeepLink(url)).toEqual({
        token: null,
        ott: null,
        error: 'access_denied',
        errorDescription: 'Link expired',
      });
    });

    it('returns null for non-auth links', () => {
      expect(parseAuthDeepLink('flashly://decks/123')).toBeNull();
    });
  });

  describe('resolveDeckDeepLink', () => {
    it('routes deck root to deck list', () => {
      expect(resolveDeckDeepLink('flashly://decks')).toEqual({ screen: 'DeckList' });
    });

    it('routes deck mode links to mapped screens', () => {
      expect(resolveDeckDeepLink('flashly://decks/deck-1/study')).toEqual({
        screen: 'Study',
        params: { deckId: 'deck-1' },
      });
      expect(resolveDeckDeepLink('flashly://decks/deck-1/learn')).toEqual({
        screen: 'LearnSetup',
        params: { deckId: 'deck-1' },
      });
    });

    it('defaults to deck overview and decodes path segments', () => {
      expect(resolveDeckDeepLink('flashly://decks/deck%201/unknown')).toEqual({
        screen: 'DeckOverview',
        params: { deckId: 'deck 1' },
      });
    });

    it('returns null for unsupported schemes/routes', () => {
      expect(resolveDeckDeepLink('https://example.com')).toBeNull();
      expect(resolveDeckDeepLink('flashly://auth')).toBeNull();
    });
  });
});
