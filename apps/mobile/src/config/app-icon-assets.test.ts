import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const ASSET_ROOT = resolve(process.cwd(), 'assets');
const COMPOSER_ROOT = resolve(ASSET_ROOT, 'app.icon');
const EXPECTED_COMPOSER_LAYER_ORDER = [
  '04-lightning-bolt.svg',
  '03-front-card.svg',
  '02-middle-card.svg',
  '01-rear-color-card.svg',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readComposerLayerNames(): string[] {
  const parsed: unknown = JSON.parse(
    readFileSync(resolve(COMPOSER_ROOT, 'icon.json'), 'utf8'),
  );
  if (!isRecord(parsed) || !Array.isArray(parsed.groups)) return [];

  return parsed.groups.flatMap((group) => {
    if (!isRecord(group) || !Array.isArray(group.layers)) return [];
    return group.layers.flatMap((layer) =>
      isRecord(layer) && typeof layer['image-name'] === 'string'
        ? [layer['image-name']]
        : [],
    );
  });
}

function readPngHeader(name: string): Readonly<{
  colorType: number;
  height: number;
  width: number;
}> {
  const png = readFileSync(resolve(ASSET_ROOT, name));
  expect([...png.subarray(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png[25] ?? -1,
  };
}

function paethPredictor(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function readPngPixel(
  name: string,
  targetX: number,
  targetY: number,
): ReadonlyArray<number> {
  const png = readFileSync(resolve(ASSET_ROOT, name));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24] ?? -1;
  const colorType = png[25] ?? -1;
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;

  if (
    bitDepth !== 8 ||
    bytesPerPixel === 0 ||
    targetX < 0 ||
    targetX >= width ||
    targetY < 0 ||
    targetY >= height
  ) {
    return [];
  }

  const idatChunks: Buffer[] = [];
  let chunkOffset = 8;
  while (chunkOffset + 12 <= png.length) {
    const chunkLength = png.readUInt32BE(chunkOffset);
    const chunkType = png.toString('ascii', chunkOffset + 4, chunkOffset + 8);
    if (chunkType === 'IDAT') {
      idatChunks.push(
        png.subarray(chunkOffset + 8, chunkOffset + 8 + chunkLength),
      );
    }
    chunkOffset += chunkLength + 12;
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const stride = width * bytesPerPixel;
  let sourceOffset = 0;
  let previousRow = Buffer.alloc(stride);

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filterType = inflated[sourceOffset] ?? -1;
    sourceOffset += 1;
    const currentRow = Buffer.alloc(stride);

    for (let index = 0; index < stride; index += 1) {
      const raw = inflated[sourceOffset + index] ?? 0;
      const left =
        index >= bytesPerPixel ? (currentRow[index - bytesPerPixel] ?? 0) : 0;
      const up = previousRow[index] ?? 0;
      const upperLeft =
        index >= bytesPerPixel ? (previousRow[index - bytesPerPixel] ?? 0) : 0;

      const predictor =
        filterType === 0
          ? 0
          : filterType === 1
            ? left
            : filterType === 2
              ? up
              : filterType === 3
                ? Math.floor((left + up) / 2)
                : filterType === 4
                  ? paethPredictor(left, up, upperLeft)
                  : Number.NaN;

      if (Number.isNaN(predictor)) return [];
      currentRow[index] = (raw + predictor) & 0xff;
    }

    sourceOffset += stride;
    if (rowIndex === targetY) {
      const pixelOffset = targetX * bytesPerPixel;
      const red = currentRow[pixelOffset] ?? -1;
      const green = currentRow[pixelOffset + 1] ?? -1;
      const blue = currentRow[pixelOffset + 2] ?? -1;
      const alpha =
        bytesPerPixel === 4 ? (currentRow[pixelOffset + 3] ?? -1) : 255;
      return [red, green, blue, alpha];
    }

    previousRow = currentRow;
  }

  return [];
}

describe('layered app icon assets', () => {
  it('stores four Composer SVG groups from foreground to background', () => {
    expect(readComposerLayerNames()).toEqual(EXPECTED_COMPOSER_LAYER_ORDER);
  });

  it.each(EXPECTED_COMPOSER_LAYER_ORDER)(
    '%s uses the shared full canvas without baked effects',
    (name) => {
      const svg = readFileSync(
        resolve(COMPOSER_ROOT, 'Assets', name),
        'utf8',
      );

      expect(svg).toContain('viewBox="0 0 1024 1024"');
      expect(svg).not.toMatch(/<filter|feDropShadow|clipPath|mask=/);
    },
  );

  it('keeps the lightning artwork clean and opaque', () => {
    const svg = readFileSync(
      resolve(COMPOSER_ROOT, 'Assets', '04-lightning-bolt.svg'),
      'utf8',
    );

    expect(svg).toContain('#FEA747');
    expect(svg).not.toMatch(/stroke=|#fff|#ffffff|opacity=/i);
  });

  it.each([
    ['icon.png', 1024],
    ['adaptive-icon.png', 1024],
    ['splash-logo-mark.png', 1024],
    ['favicon.png', 512],
    ['app-icon-preview.png', 1024],
  ])('%s has the committed export dimensions', (name, size) => {
    const header = readPngHeader(name);
    expect(header.width).toBe(size);
    expect(header.height).toBe(size);
  });

  it('keeps adaptive and splash artwork alpha-capable', () => {
    expect(readPngHeader('adaptive-icon.png').colorType).toBe(6);
    expect(readPngHeader('splash-logo-mark.png').colorType).toBe(6);
  });

  it('renders the approved orange bolt over the warm flat background', () => {
    expect(readPngPixel('icon.png', 512, 512)).toEqual([254, 167, 71, 255]);
    expect(readPngPixel('icon.png', 0, 0)).toEqual([254, 167, 71, 255]);
  });

  it('applies the Composer bolt scale and position to flat fallbacks', () => {
    expect(readPngPixel('icon.png', 370, 540)).toEqual([
      255, 255, 255, 255,
    ]);
  });

  it('keeps the adaptive foreground transparent outside the safe zone', () => {
    expect(readPngPixel('adaptive-icon.png', 512, 512)).toEqual([
      254, 167, 71, 255,
    ]);
    expect(readPngPixel('adaptive-icon.png', 0, 0)).toEqual([0, 0, 0, 0]);
  });
});
