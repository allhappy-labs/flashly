import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const MOBILE_DIR = resolve(SCRIPT_DIR, '..');
const ASSET_DIR = resolve(MOBILE_DIR, 'assets');
const COMPOSER_ASSET_DIR = resolve(ASSET_DIR, 'app.icon', 'Assets');
const composerDocument = JSON.parse(
  readFileSync(resolve(ASSET_DIR, 'app.icon', 'icon.json'), 'utf8'),
);
const LAYER_NAMES = [
  '01-rear-color-card.svg',
  '02-middle-card.svg',
  '03-front-card.svg',
  '04-lightning-bolt.svg',
];

function findLayerPosition(name) {
  for (const group of composerDocument.groups ?? []) {
    for (const layer of group.layers ?? []) {
      if (layer['image-name'] === name) return layer.position;
    }
  }
  return undefined;
}

function readSvgBody(name) {
  const svg = readFileSync(resolve(COMPOSER_ASSET_DIR, name), 'utf8');
  const bodyStart = svg.indexOf('>');
  const bodyEnd = svg.lastIndexOf('</svg>');
  if (bodyStart < 0 || bodyEnd <= bodyStart) {
    throw new Error(`Invalid SVG layer: ${name}`);
  }
  const body = svg.slice(bodyStart + 1, bodyEnd).trim();
  const position = findLayerPosition(name);
  if (!position) return body;

  const scale = position.scale ?? 1;
  const [translationX = 0, translationY = 0] =
    position['translation-in-points'] ?? [];
  return `<g transform="translate(512 512) translate(${translationX} ${translationY}) scale(${scale}) translate(-512 -512)">\n${body}\n</g>`;
}

function buildCompositeSvg(layerBodies, options = {}) {
  const background = options.background
    ? `  <rect width="1024" height="1024" fill="${options.background}"/>\n`
    : '';
  const body = layerBodies.join('\n');
  const composition = options.transform
    ? `  <g transform="${options.transform}">\n${body}\n  </g>`
    : body;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">\n${background}${composition}\n</svg>\n`;
}

function renderSvg(input, output, size) {
  execFileSync(
    'rsvg-convert',
    ['-w', String(size), '-h', String(size), '-o', output, input],
    { stdio: 'inherit' },
  );
}

execFileSync('rsvg-convert', ['--version'], { stdio: 'ignore' });

const layerBodies = LAYER_NAMES.map(readSvgBody);
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'flashly-app-icon-'));

try {
  const flatSvg = resolve(temporaryDirectory, 'flat.svg');
  const adaptiveSvg = resolve(temporaryDirectory, 'adaptive.svg');
  const splashSvg = resolve(temporaryDirectory, 'splash.svg');

  writeFileSync(
    flatSvg,
    buildCompositeSvg(layerBodies, { background: '#FEA747' }),
  );
  writeFileSync(
    adaptiveSvg,
    buildCompositeSvg(layerBodies, {
      transform: 'translate(169 169) scale(.67)',
    }),
  );
  writeFileSync(splashSvg, buildCompositeSvg(layerBodies));

  renderSvg(flatSvg, resolve(ASSET_DIR, 'icon.png'), 1024);
  renderSvg(
    adaptiveSvg,
    resolve(ASSET_DIR, 'adaptive-icon.png'),
    1024,
  );
  renderSvg(flatSvg, resolve(ASSET_DIR, 'favicon.png'), 512);
  renderSvg(
    splashSvg,
    resolve(ASSET_DIR, 'splash-logo-mark.png'),
    1024,
  );
  renderSvg(
    flatSvg,
    resolve(ASSET_DIR, 'app-icon-preview.png'),
    1024,
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
