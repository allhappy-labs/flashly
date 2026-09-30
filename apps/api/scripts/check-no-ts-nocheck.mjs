import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const API_ROOT = process.cwd();

async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.turbo') {
                continue;
            }
            files.push(...(await walk(fullPath)));
            continue;
        }

        if (entry.isFile() && fullPath.endsWith('.ts')) {
            files.push(fullPath);
        }
    }

    return files;
}

async function main() {
    const files = await walk(API_ROOT);
    const violations = [];

    for (const filePath of files) {
        const content = await readFile(filePath, 'utf8');
        if (!content.includes('@ts-nocheck')) {
            continue;
        }

        if (/(^|\n)\s*\/\/\s*@ts-nocheck\b/.test(content)) {
            violations.push(path.relative(API_ROOT, filePath));
        }
    }

    if (violations.length === 0) {
        console.log('No @ts-nocheck directives found');
        return;
    }

    console.error('@ts-nocheck usage detected (deprecated in apps/api):');
    for (const violation of violations.toSorted()) {
        console.error(`- ${violation}`);
    }
    process.exitCode = 1;
}

await main();
