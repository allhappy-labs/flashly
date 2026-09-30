import type { NavigatorScreenParams } from '@react-navigation/native';
import type { LearnOptions } from "../types/learn";

export type DeckStackParamList = {
  Intro: undefined;
  DeckList: undefined;
  DeckDetail: { deckId: string };
  DeckOverview: { deckId: string };
  DeckAnalytics: { deckId: string; windowDays?: 7 | 30 | 0 };
  DeckCreate: undefined;
  CardEdit: { deckId: string; cardId?: string };

  Study: { deckId: string };
  Browse: { deckId: string };
  Match: { deckId: string };
  Write: { deckId: string };
  Test: { deckId: string };
  LearnSetup: { deckId: string };
  Learn: { deckId: string; options: LearnOptions };

  Import: { deckId?: string; initialText?: string; deckName?: string; fileUri?: string };
  Export: undefined;

  SettingsHome: undefined;
  Language: undefined;
  FsrsSettings: undefined;
  TimeGradingSettings: undefined;
  DailyGoal: undefined;

  About: undefined;
};

export type HostedDeckStackParamList = DeckStackParamList & {
  Auth: {
    token?: string;
    ott?: string;
    error?: string;
    errorDescription?: string;
    magicLinkAttempted?: boolean;
    magicLinkNonce?: number;
  };
  AccountHome: undefined;
  Marketplace: undefined;
  MarketplaceDetail: { deckId: string };
  Help: undefined;
};

export type AppTabParamList = {
  BrowseTab: undefined;
  DecksTab: undefined;
  AccountTab: undefined;
  SettingsTab: undefined;
};

export type LocalRootStackParamList = {
  Intro: undefined;
  LocalTabs: NavigatorScreenParams<LocalTabParamList>;
};

export type LocalTabParamList = {
  DecksTab: NavigatorScreenParams<LocalDeckStackParamList>;
  SettingsTab: NavigatorScreenParams<LocalSettingsStackParamList>;
};

export type LocalDeckStackParamList = {
  DeckList: undefined;
  DeckDetail: { deckId: string };
  DeckOverview: { deckId: string };
  DeckAnalytics: { deckId: string; windowDays?: 7 | 30 | 0 };
  DeckCreate: undefined;
  CardEdit: { deckId: string; cardId?: string };
  Study: { deckId: string };
  Browse: { deckId: string };
  Match: { deckId: string };
  Write: { deckId: string };
  Test: { deckId: string };
  LearnSetup: { deckId: string };
  Learn: { deckId: string; options: LearnOptions };
  Import: { deckId?: string; initialText?: string; deckName?: string; fileUri?: string };
  Export: undefined;
  Language: undefined;
  FsrsSettings: undefined;
  TimeGradingSettings: undefined;
  DailyGoal: undefined;
  About: undefined;
};

export type LocalSettingsStackParamList = {
  SettingsHome: undefined;
  Language: undefined;
  FsrsSettings: undefined;
  TimeGradingSettings: undefined;
  DailyGoal: undefined;
  About: undefined;
};

export type LocalTabNavigation = Readonly<{
  name: 'LocalTabs';
  params: NavigatorScreenParams<LocalTabParamList>;
}>;
