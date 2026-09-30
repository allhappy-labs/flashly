import { describe, expect, it } from 'vitest';
import { createLocalImportNavigation, LOCAL_TAB_NAMES } from './local-navigation-config';

describe('local navigation', () => {
  it('exposes only Decks and Settings', () => {
    expect(LOCAL_TAB_NAMES).toEqual(['DecksTab', 'SettingsTab']);
    expect(LOCAL_TAB_NAMES).not.toContain('BrowseTab');
    expect(LOCAL_TAB_NAMES).not.toContain('AccountTab');
  });

  it('builds an import route through the local root and Decks tab', () => {
    expect(createLocalImportNavigation('file:///tmp/deck.flashly')).toEqual({
      name: 'LocalTabs',
      params: {
        screen: 'DecksTab',
        params: {
          screen: 'Import',
          params: { fileUri: 'file:///tmp/deck.flashly' },
        },
      },
    });
  });
});
