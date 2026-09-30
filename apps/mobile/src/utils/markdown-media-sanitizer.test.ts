import { describe, expect, it } from 'vitest';
import { sanitizeMarkdownImageTargets } from './markdown-media-sanitizer';

describe('sanitizeMarkdownImageTargets', () => {
  const markdown = [
    'Read [the guide](https://docs.example/guide).',
    '![Remote cover](https://cdn.example/cover.png "cover")',
    '![Local cover](file:///cards/cover.png)',
    '![Remote avatar][avatar]',
    '[avatar]: https://cdn.example/avatar.png "avatar"',
    '<img alt="Legacy cover" src="http://cdn.example/legacy.png" />',
  ].join('\n');

  it('removes HTTP(S) image targets in local mode while preserving prose, links, and local images', () => {
    expect(sanitizeMarkdownImageTargets(markdown, false)).toBe([
      'Read [the guide](https://docs.example/guide).',
      'Remote cover',
      '![Local cover](file:///cards/cover.png)',
      'Remote avatar',
      '',
      'Legacy cover',
    ].join('\n'));
  });

  it('preserves remote image syntax in hosted mode', () => {
    expect(sanitizeMarkdownImageTargets(markdown, true)).toBe(markdown);
  });

  it('keeps a remote reference definition when an ordinary Markdown link still uses it', () => {
    const sharedReference = [
      '![Cover][shared]',
      'See [documentation][shared].',
      '[shared]: https://cdn.example/shared.png',
    ].join('\n');

    expect(sanitizeMarkdownImageTargets(sharedReference, false)).toBe([
      'Cover',
      'See [documentation][shared].',
      '[shared]: https://cdn.example/shared.png',
    ].join('\n'));
  });

  it('removes valid remote inline destinations without corrupting surrounding Markdown', () => {
    const inlineImages = [
      'Before ![Space](<https://cdn.example/a b.png>) after.',
      'Before ![Diagram](https://cdn.example/a_(b).png) after.',
      'Before ![Escaped](https://cdn.example/a\\(b\\).png "title") after.',
      '![Local](file:///cards/a_(b).png)',
      '![Data](data:image/png;base64,aGVsbG8=)',
      '![Content](content://documents/a_(b).png)',
      '![Photo](ph://asset/a_(b).png)',
      '[Ordinary link](https://cdn.example/a_(b).png)',
    ].join('\n');

    expect(sanitizeMarkdownImageTargets(inlineImages, false)).toBe([
      'Before Space after.',
      'Before Diagram after.',
      'Before Escaped after.',
      '![Local](file:///cards/a_(b).png)',
      '![Data](data:image/png;base64,aGVsbG8=)',
      '![Content](content://documents/a_(b).png)',
      '![Photo](ph://asset/a_(b).png)',
      '[Ordinary link](https://cdn.example/a_(b).png)',
    ].join('\n'));
  });

  it('removes remote destinations after Markdown entity and escape decoding', () => {
    const encodedRemoteMedia = [
      'Before ![Entity](&#x68;ttps://cdn.example/entity.png) after.',
      'Before ![Angle entity](<&#x68;ttps://cdn.example/angle-entity.png>) after.',
      'Before ![Decimal entity](&#104;ttps://cdn.example/decimal-entity.png) after.',
      'Before ![Named entity](https&colon;//cdn.example/named-entity.png) after.',
      'Before ![EscapedScheme](https\\://cdn.example/escaped-scheme.png) after.',
      '![Reference entity][entity-reference]',
      '[entity-reference]: https&colon;//cdn.example/reference-entity.png',
      '![Reference escape][escaped-reference]',
      '[escaped-reference]: https\\://cdn.example/reference-escape.png',
      '<img alt="HTML entity" src="https&colon;//cdn.example/html-entity.png" />',
      '<img alt="HTML escape" src="https\\://cdn.example/html-escape.png" />',
      '<img alt="Deferred" data-src="https://cdn.example/deferred.png" />',
    ].join('\n');

    expect(sanitizeMarkdownImageTargets(encodedRemoteMedia, false)).toBe([
      'Before Entity after.',
      'Before Angle entity after.',
      'Before Decimal entity after.',
      'Before Named entity after.',
      'Before EscapedScheme after.',
      'Reference entity',
      '',
      'Reference escape',
      '',
      'HTML entity',
      'HTML escape',
      '<img alt="Deferred" data-src="https://cdn.example/deferred.png" />',
    ].join('\n'));
  });

  it('preserves invalid inline image syntax while accepting valid escaped titles', () => {
    const images = [
      '![Valid double](https://cdn.example/double.png "a \\"quoted\\" title")',
      "![Valid single](https://cdn.example/single.png 'a \\'quoted\\' title')",
      '![Valid paren](https://cdn.example/paren.png (a title))',
      '![ParenTitle](https://cdn.example/a.png (a (nested) title))',
      '![Trailing](https://cdn.example/trailing.png "title" trailing)',
    ].join('\n');

    expect(sanitizeMarkdownImageTargets(images, false)).toBe([
      'Valid double',
      'Valid single',
      'Valid paren',
      '![ParenTitle](https://cdn.example/a.png (a (nested) title))',
      '![Trailing](https://cdn.example/trailing.png "title" trailing)',
    ].join('\n'));
  });

  it('removes complete remote HTML image tags with quoted angle brackets only in local mode', () => {
    const htmlImages = [
      '<img alt="A > B" src="https://cdn.example/html.png" />',
      '<img src="https://cdn.example/a>b.png" alt="Source >">',
      '<img alt="Deferred" data-src="https://cdn.example/deferred.png" />',
      '<img alt="File" src="file:///cards/local.png" />',
      '<img alt="Data" src="data:image/png;base64,aGVsbG8=" />',
      '<img alt="Content" src="content://documents/local.png" />',
      '<img alt="Photo" src="ph://asset/local.png" />',
    ].join('\n');

    expect(sanitizeMarkdownImageTargets(htmlImages, false)).toBe([
      'A > B',
      'Source >',
      '<img alt="Deferred" data-src="https://cdn.example/deferred.png" />',
      '<img alt="File" src="file:///cards/local.png" />',
      '<img alt="Data" src="data:image/png;base64,aGVsbG8=" />',
      '<img alt="Content" src="content://documents/local.png" />',
      '<img alt="Photo" src="ph://asset/local.png" />',
    ].join('\n'));
    expect(sanitizeMarkdownImageTargets(htmlImages, true)).toBe(htmlImages);
  });

  it('preserves unterminated quoted HTML image tags', () => {
    const malformedTag = '<img alt="Unclosed >" src="https://cdn.example/html.png';

    expect(sanitizeMarkdownImageTargets(malformedTag, false)).toBe(malformedTag);
  });
});
