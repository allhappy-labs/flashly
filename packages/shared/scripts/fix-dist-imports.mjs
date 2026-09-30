import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIST_DIR = new URL('../dist', import.meta.url).pathname;
const IMPORT_EXPORT_PATTERN =
  /(?<=\bfrom\s*['"])(\.[^'"]+)(?=['"])|(?<=\bimport\s*\(\s*['"])(\.[^'"]+)(?=['"]\s*\))/g;
const KNOWN_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json']);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const walkJsFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkJsFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
};

const resolveRuntimeSpecifier = async (filePath, specifier) => {
  if (!specifier.startsWith('.')) {
    return null;
  }

  if (KNOWN_EXTENSIONS.has(path.extname(specifier))) {
    return null;
  }

  const basePath = path.resolve(path.dirname(filePath), specifier);
  const jsCandidate = `${basePath}.js`;
  const indexCandidate = path.join(basePath, 'index.js');

  try {
    const jsStats = await stat(jsCandidate);
    if (jsStats.isFile()) {
      return `${specifier}.js`;
    }
  } catch {}

  try {
    const indexStats = await stat(indexCandidate);
    if (indexStats.isFile()) {
      return `${specifier}/index.js`;
    }
  } catch {}

  return null;
};

const fixFile = async (filePath) => {
  const source = await readFile(filePath, 'utf8');
  const matches = [...source.matchAll(IMPORT_EXPORT_PATTERN)];
  if (matches.length === 0) {
    return false;
  }

  let nextSource = source;
  const processedSpecifiers = new Set();

  for (const match of matches) {
    const rawSpecifier = match[1] ?? match[2];
    if (!rawSpecifier) {
      continue;
    }

    if (processedSpecifiers.has(rawSpecifier)) {
      continue;
    }
    processedSpecifiers.add(rawSpecifier);

    const fixedSpecifier = await resolveRuntimeSpecifier(filePath, rawSpecifier);
    if (!fixedSpecifier) {
      continue;
    }

    const quotedSpecifierPattern = new RegExp(`(['"])${escapeRegExp(rawSpecifier)}\\1`, 'g');
    nextSource = nextSource.replace(quotedSpecifierPattern, (fullMatch, quote) =>
      fullMatch.replace(`${quote}${rawSpecifier}${quote}`, `${quote}${fixedSpecifier}${quote}`),
    );
  }

  if (nextSource === source) {
    return false;
  }

  await writeFile(filePath, nextSource);
  return true;
};

const main = async () => {
  const jsFiles = await walkJsFiles(DIST_DIR);
  await Promise.all(jsFiles.map((filePath) => fixFile(filePath)));
};

await main();
