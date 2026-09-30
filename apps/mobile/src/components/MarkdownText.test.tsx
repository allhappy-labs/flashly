import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
}));

vi.mock('react-native-markdown-display', () => ({ default: 'Markdown' }));

import MarkdownText from './MarkdownText';

describe('MarkdownText', () => {
  it('passes the local image policy to the markdown renderer', () => {
    const element = MarkdownText({
      value: '![Remote image](https://cdn.example/card.jpg)',
      color: '#111111',
    });

    expect(element).not.toBeNull();
    expect(element?.props.allowedImageHandlers).toEqual(['data:image/', 'file://', 'content://', 'ph://']);
    expect(element?.props.defaultImageHandler).toBeNull();
  });
});
