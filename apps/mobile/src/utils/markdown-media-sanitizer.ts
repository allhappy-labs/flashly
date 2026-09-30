type RemoteImageReference = Readonly<{
  label: string;
}>;

type ReferenceDefinition = Readonly<{
  label: string;
  destination: string;
}>;

type InlineImage = Readonly<{
  altText: string;
  destination: string;
  end: number;
}>;

type ParsedDestination = Readonly<{
  destination: string;
  end: number;
}>;

type DecodedEntity = Readonly<{
  value: string;
  end: number;
}>;

const HTML_IMAGE_SOURCE = /(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const IMAGE_REFERENCE = /!\[([^\]]*)\](?:\[([^\]]*)\])?(?!\s*\()/g;
const MARKDOWN_ESCAPABLE_PUNCTUATION = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
const NAMED_DESTINATION_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  colon: ':',
  gt: '>',
  lt: '<',
  quot: '"',
  sol: '/',
};

function isMarkdownWhitespace(value: string): boolean {
  return value === ' ' || value === '\t' || value === '\n' || value === '\r';
}

function skipMarkdownWhitespace(value: string, start: number): number {
  let position = start;
  while (position < value.length && isMarkdownWhitespace(value[position] ?? '')) {
    position += 1;
  }
  return position;
}

function isValidEntityCodePoint(codePoint: number): boolean {
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return false;
  if (codePoint >= 0xfdd0 && codePoint <= 0xfdef) return false;
  if (codePoint % 0x10000 === 0xfffe || codePoint % 0x10000 === 0xffff) return false;
  if (codePoint >= 0x00 && codePoint <= 0x08) return false;
  if (codePoint === 0x0b) return false;
  if (codePoint >= 0x0e && codePoint <= 0x1f) return false;
  if (codePoint >= 0x7f && codePoint <= 0x9f) return false;
  return codePoint <= 0x10ffff;
}

function decodeMarkdownEntity(value: string, start: number): DecodedEntity | null {
  const end = value.indexOf(';', start + 1);
  if (end === -1) return null;

  const name = value.slice(start + 1, end);
  if (!/^[a-z#][a-z0-9]{1,31}$/i.test(name)) return null;

  const named = NAMED_DESTINATION_ENTITIES[name];
  if (named) return { value: named, end: end + 1 };

  const numeric = /^#(?:x[0-9a-f]{1,8}|[0-9]{1,8})$/i.test(name);
  if (!numeric) return null;

  const codePoint = name[1]?.toLowerCase() === 'x'
    ? Number.parseInt(name.slice(2), 16)
    : Number.parseInt(name.slice(1), 10);
  if (!isValidEntityCodePoint(codePoint)) return null;

  return { value: String.fromCodePoint(codePoint), end: end + 1 };
}

function canonicalizeMarkdownDestination(value: string): string {
  let result = '';
  let position = 0;

  while (position < value.length) {
    const character = value[position] ?? '';
    const next = value[position + 1] ?? '';
    if (character === '\\' && MARKDOWN_ESCAPABLE_PUNCTUATION.includes(next)) {
      result += next;
      position += 2;
      continue;
    }
    if (character === '&') {
      const entity = decodeMarkdownEntity(value, position);
      if (entity) {
        result += entity.value;
        position = entity.end;
        continue;
      }
    }
    result += character;
    position += 1;
  }

  return result;
}

function isRemoteDestination(value: string): boolean {
  return /^https?:\/\//i.test(canonicalizeMarkdownDestination(value).trim());
}

function isEscaped(value: string, position: number): boolean {
  let slashCount = 0;
  let cursor = position - 1;
  while (cursor >= 0 && value[cursor] === '\\') {
    slashCount += 1;
    cursor -= 1;
  }
  return slashCount % 2 === 1;
}

function readBracketedText(value: string, start: number): number | null {
  let depth = 1;
  let position = start;

  while (position < value.length) {
    const character = value[position] ?? '';
    if (character === '\\' && position + 1 < value.length) {
      position += 2;
      continue;
    }
    if (character === '[') depth += 1;
    if (character === ']') {
      depth -= 1;
      if (depth === 0) return position;
    }
    position += 1;
  }

  return null;
}

function readParenthesizedTitle(value: string, start: number): number | null {
  let depth = 1;
  let position = start + 1;

  while (position < value.length) {
    const character = value[position] ?? '';
    if (character === '\\' && position + 1 < value.length) {
      position += 2;
      continue;
    }
    if (character === '(') return null;
    if (character === ')') {
      depth -= 1;
      if (depth === 0) return position + 1;
    }
    position += 1;
  }

  return null;
}

function readQuotedTitle(value: string, start: number): number | null {
  const quote = value[start];
  let position = start + 1;

  while (position < value.length) {
    const character = value[position] ?? '';
    if (character === '\\' && position + 1 < value.length) {
      position += 2;
      continue;
    }
    if (character === quote) return position + 1;
    position += 1;
  }

  return null;
}

function readImageEndAfterDestination(value: string, start: number): number | null {
  const afterWhitespace = skipMarkdownWhitespace(value, start);
  if (value[afterWhitespace] === ')') return afterWhitespace + 1;
  if (afterWhitespace === start) return null;

  const titleStart = value[afterWhitespace] ?? '';
  const afterTitle = titleStart === '('
    ? readParenthesizedTitle(value, afterWhitespace)
    : titleStart === '"' || titleStart === "'"
      ? readQuotedTitle(value, afterWhitespace)
      : null;
  if (afterTitle === null) return null;

  const closing = skipMarkdownWhitespace(value, afterTitle);
  return value[closing] === ')' ? closing + 1 : null;
}

function readAngleDestination(value: string, start: number): number | null {
  let position = start + 1;
  while (position < value.length) {
    const character = value[position] ?? '';
    if (character === '\\' && position + 1 < value.length) {
      position += 2;
      continue;
    }
    if (character === '>') return position;
    position += 1;
  }
  return null;
}

function readBareDestinationEnd(value: string, start: number): number | null {
  let depth = 0;
  let position = start;

  while (position < value.length) {
    const character = value[position] ?? '';
    if (character === '\\' && position + 1 < value.length) {
      position += 2;
      continue;
    }
    if (character === '(') {
      depth += 1;
      position += 1;
      continue;
    }
    if (character === ')') {
      if (depth === 0) return position;
      depth -= 1;
      position += 1;
      continue;
    }
    if (depth === 0 && isMarkdownWhitespace(character)) {
      return position;
    }
    position += 1;
  }

  return depth === 0 ? position : null;
}

function readDestination(value: string, start: number): ParsedDestination | null {
  if (value[start] === '<') {
    const end = readAngleDestination(value, start);
    if (end === null) return null;
    return {
      destination: value.slice(start + 1, end),
      end: end + 1,
    };
  }

  const end = readBareDestinationEnd(value, start);
  if (end === null || end === start) return null;
  return {
    destination: value.slice(start, end),
    end,
  };
}

function parseInlineImage(value: string, start: number): InlineImage | null {
  if (value[start] !== '!' || value[start + 1] !== '[' || isEscaped(value, start)) return null;

  const altEnd = readBracketedText(value, start + 2);
  if (altEnd === null || value[altEnd + 1] !== '(') return null;

  const destinationStart = skipMarkdownWhitespace(value, altEnd + 2);
  const destination = readDestination(value, destinationStart);
  if (destination === null) return null;
  const end = readImageEndAfterDestination(value, destination.end);
  if (end === null) return null;

  return {
    altText: value.slice(start + 2, altEnd),
    destination: destination.destination,
    end,
  };
}

function sanitizeInlineRemoteImages(value: string): string {
  let output = '';
  let copyStart = 0;
  let position = 0;
  let removedRemoteImage = false;

  while (position < value.length) {
    const image = parseInlineImage(value, position);
    if (image === null) {
      position += 1;
      continue;
    }

    if (isRemoteDestination(image.destination)) {
      output += value.slice(copyStart, position);
      output += image.altText;
      copyStart = image.end;
      removedRemoteImage = true;
    }
    position = image.end;
  }

  return removedRemoteImage ? `${output}${value.slice(copyStart)}` : value;
}

function normalizeReferenceLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseReferenceDefinition(value: string): ReferenceDefinition | null {
  let position = 0;
  let indentation = 0;
  while (indentation < 3 && (value[position] === ' ' || value[position] === '\t')) {
    position += 1;
    indentation += 1;
  }

  if (value[position] !== '[') return null;
  const labelStart = position + 1;
  const labelEnd = readBracketedText(value, labelStart);
  if (labelEnd === null || labelEnd === labelStart || value[labelEnd + 1] !== ':') return null;

  const destinationStart = skipMarkdownWhitespace(value, labelEnd + 2);
  const destination = readDestination(value, destinationStart);
  if (destination === null) return null;

  const titleStart = skipMarkdownWhitespace(value, destination.end);
  if (titleStart === value.length) {
    return {
      label: value.slice(labelStart, labelEnd),
      destination: destination.destination,
    };
  }
  if (titleStart === destination.end) return null;

  const marker = value[titleStart] ?? '';
  const titleEnd = marker === '('
    ? readParenthesizedTitle(value, titleStart)
    : marker === '"' || marker === "'"
      ? readQuotedTitle(value, titleStart)
      : null;
  if (titleEnd === null || skipMarkdownWhitespace(value, titleEnd) !== value.length) return null;

  return {
    label: value.slice(labelStart, labelEnd),
    destination: destination.destination,
  };
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function remoteImageReferences(value: string): RemoteImageReference[] {
  const references: RemoteImageReference[] = [];

  for (const line of value.split('\n')) {
    const definition = parseReferenceDefinition(line);
    if (definition && isRemoteDestination(definition.destination)) {
      references.push({ label: normalizeReferenceLabel(definition.label) });
    }
  }

  return references;
}

function htmlImageSource(tag: string): string | null {
  const sourceMatch = tag.match(HTML_IMAGE_SOURCE);
  return sourceMatch?.[1] ?? sourceMatch?.[2] ?? sourceMatch?.[3] ?? null;
}

function htmlImageAltText(tag: string): string {
  const altMatch = tag.match(/(?:^|\s)alt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  return altMatch?.[1] ?? altMatch?.[2] ?? altMatch?.[3] ?? '';
}

function readHtmlImageTagEnd(value: string, start: number): number | null {
  if (value[start] !== '<' || value.slice(start, start + 4).toLowerCase() !== '<img') return null;

  const afterTagName = value[start + 4] ?? '';
  if (!isMarkdownWhitespace(afterTagName) && afterTagName !== '/' && afterTagName !== '>') return null;

  let quote = '';
  let position = start + 4;
  while (position < value.length) {
    const character = value[position] ?? '';
    if (quote) {
      if (character === quote) quote = '';
      position += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      position += 1;
      continue;
    }
    if (character === '>') return position + 1;
    position += 1;
  }

  return null;
}

function sanitizeHtmlRemoteImages(value: string): string {
  let output = '';
  let copyStart = 0;
  let position = 0;
  let removedRemoteImage = false;

  while (position < value.length) {
    const end = readHtmlImageTagEnd(value, position);
    if (end === null) {
      position += 1;
      continue;
    }

    const tag = value.slice(position, end);
    const source = htmlImageSource(tag);
    if (source !== null && isRemoteDestination(source)) {
      output += value.slice(copyStart, position);
      output += htmlImageAltText(tag);
      copyStart = end;
      removedRemoteImage = true;
    }
    position = end;
  }

  return removedRemoteImage ? `${output}${value.slice(copyStart)}` : value;
}

function hasOrdinaryReferenceLink(value: string, label: string): boolean {
  const escapedLabel = escapeForRegExp(label);
  const explicitReference = new RegExp(`(^|[^!])\\[[^\\]]+\\]\\[${escapedLabel}\\]`, 'im');
  const collapsedReference = new RegExp(`(^|[^!])\\[${escapedLabel}\\]\\[\\]`, 'im');
  const shortcutReference = new RegExp(`(^|[^!])\\[${escapedLabel}\\](?!\\s*[:\\[(])`, 'im');

  return explicitReference.test(value) || collapsedReference.test(value) || shortcutReference.test(value);
}

function removeUnusedRemoteReferenceDefinitions(
  value: string,
  references: RemoteImageReference[],
): string {
  const remoteLabels = new Set(references.map((reference) => reference.label));

  return value
    .split('\n')
    .map((line) => {
      const definition = parseReferenceDefinition(line);
      if (!definition || !remoteLabels.has(normalizeReferenceLabel(definition.label))) return line;
      return hasOrdinaryReferenceLink(value, normalizeReferenceLabel(definition.label)) ? line : '';
    })
    .join('\n');
}

/**
 * Removes remote image targets from card Markdown for local-only persistence.
 * Non-image links remain untouched, including reference definitions still used
 * by ordinary Markdown links.
 */
export function sanitizeMarkdownImageTargets(value: string, allowRemoteMedia: boolean): string {
  if (allowRemoteMedia || !value) return value;

  const references = remoteImageReferences(value);
  const remoteReferenceLabels = new Set(references.map((reference) => reference.label));
  const withoutInlineRemoteImages = sanitizeInlineRemoteImages(value);
  const withoutRemoteHtmlImages = sanitizeHtmlRemoteImages(withoutInlineRemoteImages)
    .replace(IMAGE_REFERENCE, (match: string, altText: string, explicitLabel: string | undefined) => {
      const label = normalizeReferenceLabel(explicitLabel || altText);
      return remoteReferenceLabels.has(label) ? altText : match;
    });

  return removeUnusedRemoteReferenceDefinitions(withoutRemoteHtmlImages, references);
}
