import { describe, expect, it } from 'vitest';
import { capabilitiesForMode, resolveAppMode } from './app-mode';

describe('resolveAppMode', () => {
  it.each([
    [undefined, 'local'],
    [null, 'local'],
    ['', 'local'],
    ['local', 'local'],
    ['HOSTED', 'local'],
    ['hosted ', 'local'],
    ['unknown', 'local'],
    ['hosted', 'hosted'],
  ])('maps %s to %s', (input, expected) => {
    expect(resolveAppMode(input)).toBe(expected);
  });
});

describe('capabilitiesForMode', () => {
  it('disables every hosted capability in local mode', () => {
    expect(capabilitiesForMode('local')).toEqual({
      authentication: false,
      sync: false,
      marketplace: false,
      remoteAnalytics: false,
      externalProductLinks: false,
      remoteMedia: false,
    });
  });

  it('enables the hosted capability bundle together', () => {
    expect(capabilitiesForMode('hosted')).toEqual({
      authentication: true,
      sync: true,
      marketplace: true,
      remoteAnalytics: true,
      externalProductLinks: true,
      remoteMedia: true,
    });
  });
});
