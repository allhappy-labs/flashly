import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const MOBILE_SOURCE_ROOT = fileURLToPath(new URL('../', import.meta.url).href);
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const FORBIDDEN_LOCAL_RUNTIME_MODULES = [
  'services/analytics/analytics-service',
  'services/auth',
  'services/init',
  'services/marketplace',
  'services/sync/sync-service',
  'lib/api',
  'lib/trpc',
  '@react-native-community/netinfo',
];

function hasRuntimeImport(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  if (!clause.namedBindings) return false;
  if (ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

function staticImportSpecifiers(filePath: string): string[] {
  const source = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers: string[] = [];

  source.forEachChild((node) => {
    if (
      ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && hasRuntimeImport(node)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
  });

  return specifiers;
}

function resolveLocalModule(fromFilePath: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;

  const candidate = resolve(dirname(fromFilePath), specifier);
  const fileCandidates = [
    candidate,
    ...SOURCE_EXTENSIONS.map((extension) => `${candidate}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => resolve(candidate, `index${extension}`)),
  ];

  return fileCandidates.find((filePath) => existsSync(filePath) && statSync(filePath).isFile()) ?? null;
}

function collectStaticImportGraph(entryPoints: string[]) {
  const pending = [...entryPoints];
  const visited = new Set<string>();
  const packageImports = new Set<string>();

  while (pending.length > 0) {
    const next = pending.pop();
    if (!next || visited.has(next)) continue;
    visited.add(next);

    for (const specifier of staticImportSpecifiers(next)) {
      const localModule = resolveLocalModule(next, specifier);
      if (localModule) {
        pending.push(localModule);
      } else {
        packageImports.add(specifier);
      }
    }
  }

  return { files: visited, packageImports };
}

function forbiddenModulesInLocalRuntimeGraph() {
  const graph = collectStaticImportGraph([
    resolve(MOBILE_SOURCE_ROOT, 'app/LocalAppRuntime.tsx'),
    resolve(MOBILE_SOURCE_ROOT, 'navigation/LocalAppNavigator.tsx'),
  ]);
  const importedFiles = [...graph.files].map((filePath) => relative(MOBILE_SOURCE_ROOT, filePath).replaceAll('\\', '/'));
  const importedPackages = [...graph.packageImports];

  return [...importedFiles, ...importedPackages].filter((moduleName) => (
    FORBIDDEN_LOCAL_RUNTIME_MODULES.some((forbiddenModule) => moduleName.includes(forbiddenModule))
  ));
}

describe('LocalAppRuntime static import graph', () => {
  it('does not evaluate hosted services while loading local navigation screens', () => {
    expect(forbiddenModulesInLocalRuntimeGraph()).toEqual([]);
  });
});
