import type {
  DeckStackParamList,
  HostedDeckStackParamList,
  LocalDeckStackParamList,
  LocalRootStackParamList,
  LocalSettingsStackParamList,
  LocalTabParamList,
} from './types';

type HostedOnlyRoute = 'AccountHome' | 'Auth' | 'Help' | 'Marketplace' | 'MarketplaceDetail';
type AssertNever<Value extends never> = Value;
type AssertAuthRoute<Value extends 'Auth'> = Value;

type CoreStackMustExcludeHostedRoutes = AssertNever<Extract<keyof DeckStackParamList, HostedOnlyRoute>>;
type HostedStackMustIncludeAuth = AssertAuthRoute<Extract<keyof HostedDeckStackParamList, 'Auth'>>;
type LocalRootStackMustExcludeHostedRoutes = AssertNever<Extract<keyof LocalRootStackParamList, HostedOnlyRoute>>;
type LocalTabStackMustExcludeHostedRoutes = AssertNever<Extract<keyof LocalTabParamList, HostedOnlyRoute>>;
type LocalDeckStackMustExcludeHostedRoutes = AssertNever<Extract<keyof LocalDeckStackParamList, HostedOnlyRoute>>;
type LocalSettingsStackMustExcludeHostedRoutes = AssertNever<Extract<keyof LocalSettingsStackParamList, HostedOnlyRoute>>;

export type LocalRouteIsolationContract =
  | CoreStackMustExcludeHostedRoutes
  | HostedStackMustIncludeAuth
  | LocalRootStackMustExcludeHostedRoutes
  | LocalTabStackMustExcludeHostedRoutes
  | LocalDeckStackMustExcludeHostedRoutes
  | LocalSettingsStackMustExcludeHostedRoutes;
