import { describe, expect, it } from 'vitest';
import { getIntroSlideKeys } from './intro-slide-keys';

describe('getIntroSlideKeys', () => {
  it('omits the sync slide when sync is disabled', () => {
    expect(getIntroSlideKeys(false)).toEqual(['language', 'create', 'recall']);
  });

  it('includes the sync slide when sync is enabled', () => {
    expect(getIntroSlideKeys(true)).toEqual(['language', 'create', 'recall', 'sync']);
  });
});
