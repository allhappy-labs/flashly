import type { LocalTabNavigation, LocalTabParamList } from './types';

export const LOCAL_TAB_NAMES: ReadonlyArray<keyof LocalTabParamList> = [
  'DecksTab',
  'SettingsTab',
];

export function createLocalImportNavigation(fileUri: string): LocalTabNavigation {
  return {
    name: 'LocalTabs',
    params: {
      screen: 'DecksTab',
      params: {
        screen: 'Import',
        params: { fileUri },
      },
    },
  };
}
