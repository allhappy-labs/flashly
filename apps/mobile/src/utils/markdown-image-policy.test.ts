import { describe, expect, it } from 'vitest';
import { markdownImagePolicy } from './markdown-image-policy';

describe('markdown image policy', () => {
  it('rejects HTTP images and disables the fallback handler locally', () => {
    expect(markdownImagePolicy(false)).toEqual({
      allowedImageHandlers: ['data:image/', 'file://', 'content://', 'ph://'],
      defaultImageHandler: null,
    });
  });

  it('retains remote image rendering in hosted mode', () => {
    expect(markdownImagePolicy(true)).toEqual({
      allowedImageHandlers: [
        'data:image/png;base64',
        'data:image/gif;base64',
        'data:image/jpeg;base64',
        'https://',
        'http://',
      ],
      defaultImageHandler: 'https://',
    });
  });
});
