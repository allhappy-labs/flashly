import type { FSRSParameters } from "ts-fsrs";
import type { Card, Deck, DeckWithStats, ParsedCard } from "../types/models";
import type { TimeGradingConfig } from "../utils/timeGrading";

export type StoreState = {
  initialized: boolean;
  language: string;
  introSeen: boolean;
  userId: string | null;
  decks: DeckWithStats[];
  initialize: (preferredLanguage?: string | null) => Promise<void>;
  refreshDecks: () => Promise<void>;
  refreshDeckById: (deckId: string) => Promise<void>;
  addDeck: (
    name: string,
    description?: string,
    accentKey?: string,
    materialType?: string,
    deckType?: string,
    locale?: string
  ) => Promise<string>;
  removeDeck: (deckId: string) => Promise<void>;
  saveDeckDetails: (
    deckId: string,
    updates: Partial<Pick<Deck, "name" | "description" | "accentKey" | "visibility">>
  ) => Promise<void>;
  setDeckVisibility: (deckId: string, visibility: 'private' | 'public') => Promise<void>;
  setLanguage: (code: string) => Promise<void>;
  setIntroSeen: (seen: boolean) => Promise<void>;
  loadCards: (deckId: string) => Promise<Card[]>;
  saveCard: (
    deckId: string,
    payload: {
      cardId?: string;
      front: string;
      back: string;
      imageUrl?: string | null;
      audioUrl?: string | null;
      category?: string | null;
      pos?: string | null;
      gender?: string | null;
      example?: string | null;
      tags?: string[];
    },
  ) => Promise<string>;
  removeCard: (cardId: string, deckId: string) => Promise<void>;
  recordStudy: (deckId: string) => Promise<void>;
  bulkAddCards: (deckId: string, cards: ParsedCard[]) => Promise<void>;
  resetProgress: (deckId: string) => Promise<void>;
  fsrsParams: Partial<FSRSParameters>;
  setFsrsParams: (params: Partial<FSRSParameters>) => Promise<void>;
  studySyncToken: number;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => Promise<void>;
  dailyGoal: number;
  allowExtraNew: boolean;
  setDailyGoal: (goal: number) => Promise<void>;
  setAllowExtraNew: (enabled: boolean) => Promise<void>;
  timeGradingConfig: TimeGradingConfig;
  setTimeGradingConfig: (config: Partial<TimeGradingConfig>) => Promise<void>;
  setUserId: (userId: string | null) => void;
  clearDecks: () => void;
  queueSync: (
    entityType: 'deck' | 'card',
    entityId: string,
    operation: 'create' | 'update' | 'delete',
    data: Record<string, unknown>
  ) => Promise<void>;
};
