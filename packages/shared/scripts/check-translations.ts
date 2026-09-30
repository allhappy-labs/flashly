#!/usr/bin/env node

/**
 * Translation Sync Checker
 *
 * This script verifies that all translation files have the same leaf keys.
 * English (eng.ts) is considered the source of truth.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Locale metadata
const LOCALES = [
    { code: 'eng', name: 'English', file: 'eng.ts' },
    { code: 'deu', name: 'German', file: 'deu.ts' },
    { code: 'spa', name: 'Spanish', file: 'spa.ts' },
    { code: 'fra', name: 'French', file: 'fra.ts' },
    { code: 'ukr', name: 'Ukrainian', file: 'ukr.ts' },
];
const SOURCE_LOCALE = 'eng';

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

const scriptFilePath = fileURLToPath(import.meta.url);
const scriptDirectoryPath = dirname(scriptFilePath);
const LOCALES_DIR = join(scriptDirectoryPath, '../src/i18n/locales');

function getPropertyName(nameNode: ts.PropertyName): string | null {
    if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode)) {
        return nameNode.text;
    }
    if (ts.isComputedPropertyName(nameNode)) {
        if (ts.isStringLiteral(nameNode.expression) || ts.isNumericLiteral(nameNode.expression)) {
            return nameNode.expression.text;
        }
        return null;
    }
    return null;
}

function collectLeafKeys(objLiteral: ts.ObjectLiteralExpression, prefix = '', out: string[] = []): string[] {
    for (const property of objLiteral.properties) {
        if (!ts.isPropertyAssignment(property)) {
            continue;
        }

        const name = getPropertyName(property.name);
        if (!name) {
            continue;
        }

        const key = prefix ? `${prefix}.${name}` : name;
        if (ts.isObjectLiteralExpression(property.initializer)) {
            collectLeafKeys(property.initializer, key, out);
        } else {
            out.push(key);
        }
    }

    return out;
}

function parseLocaleLeafKeys(filePath: string): string[] {
    const sourceText = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    const exportDefault = sourceFile.statements.find((statement) => {
        return ts.isExportAssignment(statement) && ts.isObjectLiteralExpression(statement.expression);
    });

    if (!exportDefault || !ts.isExportAssignment(exportDefault) || !ts.isObjectLiteralExpression(exportDefault.expression)) {
        throw new Error(`Could not find "export default { ... }" object`);
    }

    return [...new Set(collectLeafKeys(exportDefault.expression))].toSorted();
}

function formatKeyCount(count: number, expected: number): string {
    const isCorrect = count === expected;
    const status = isCorrect ? '✓' : '✗';
    const color = isCorrect ? colors.green : colors.red;

    let diff = '';
    if (!isCorrect) {
        const diffCount = expected - count;
        if (diffCount > 0) {
            diff = `${colors.red} (${diffCount} missing)${colors.reset}`;
        } else {
            diff = `${colors.red} (${Math.abs(diffCount)} extra)${colors.reset}`;
        }
    }

    return `${color}${count}${colors.reset} keys ${status}${diff}`;
}

async function main() {
    console.log(`${colors.cyan}🔍 Checking translation sync status...${colors.reset}\n`);

    const localeKeys: Partial<Record<(typeof LOCALES)[number]['code'], string[]>> = {};
    const loadErrors: Array<{ code: string; name: string; error: string }> = [];

    for (const locale of LOCALES) {
        const filePath = join(LOCALES_DIR, locale.file);
        try {
            localeKeys[locale.code] = parseLocaleLeafKeys(filePath);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            loadErrors.push({ code: locale.code, name: locale.name, error: message });
        }
    }

    const sourceKeys = localeKeys[SOURCE_LOCALE];
    if (!sourceKeys) {
        console.error(`${colors.red}❌ Failed to load source locale (${SOURCE_LOCALE}).${colors.reset}`);
        for (const item of loadErrors) {
            console.error(`  ${item.code} (${item.name}): ${item.error}`);
        }
        process.exit(1);
    }

    const sourceCount = sourceKeys.length;

    console.log(`${colors.bright}📊 Key counts:${colors.reset}`);
    for (const locale of LOCALES) {
        const keys = localeKeys[locale.code];
        const isSource = locale.code === SOURCE_LOCALE;
        const source = isSource ? ' (source/master)' : '';
        if (!keys) {
            console.log(`  ${locale.code.padEnd(3)} (${locale.name.padEnd(12)}): ${colors.red}load failed${colors.reset}${source}`);
            continue;
        }
        console.log(`  ${locale.code.padEnd(3)} (${locale.name.padEnd(12)}): ${formatKeyCount(keys.length, sourceCount)}${source}`);
    }
    console.log();

    const syncErrors: Array<{ locale: string; name: string; missing: string[]; extra: string[] }> = [];

    for (const locale of LOCALES) {
        if (locale.code === SOURCE_LOCALE) {
            continue;
        }

        const keys = localeKeys[locale.code];
        if (!keys) {
            continue;
        }

        const sourceSet = new Set(sourceKeys);
        const targetSet = new Set(keys);
        const missing = sourceKeys.filter((key) => !targetSet.has(key));
        const extra = keys.filter((key) => !sourceSet.has(key));

        if (missing.length > 0 || extra.length > 0) {
            syncErrors.push({ locale: locale.code, name: locale.name, missing, extra });
        }
    }

    if (loadErrors.length > 0) {
        console.log(`${colors.red}❌ Failed to parse locale files:${colors.reset}`);
        for (const item of loadErrors) {
            console.log(`   ${colors.yellow}-${colors.reset} ${item.code} (${item.name}): ${item.error}`);
        }
        console.log();
    }

    if (syncErrors.length > 0) {
        console.log();

        for (const error of syncErrors) {
            if (error.missing.length > 0) {
                console.log(`${colors.red}❌ Missing keys in ${error.locale} (${error.name}):${colors.reset}`);
                for (const key of error.missing) {
                    console.log(`   ${colors.yellow}-${colors.reset} ${key}`);
                }
                console.log();
            }

            if (error.extra.length > 0) {
                console.log(`${colors.magenta}⚠️  Extra keys in ${error.locale} (${error.name}):${colors.reset}`);
                for (const key of error.extra) {
                    console.log(`   ${colors.yellow}+${colors.reset} ${key}`);
                }
                console.log();
            }
        }
    }

    if (loadErrors.length === 0 && syncErrors.length === 0) {
        console.log(`${colors.green}✨ All translations are in sync!${colors.reset}\n`);
        process.exit(0);
    }

    console.log(`${colors.red}❌ Translations are out of sync.${colors.reset}\n`);
    process.exit(1);
}

// Run the script
main();
