import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const API_ROOT = process.cwd();
const ROUTES_DIR = path.join(API_ROOT, 'routes');

const INLINE_ERROR_PATTERNS = [
    /reply\.code\([^)]*\)\.send\(\{\s*error:\s*error\.code,\s*message:\s*error\.message\s*\}\)/g,
    /reply\.code\([^)]*\)\.send\(\{\s*error:\s*getErrorCode\([^)]*\),\s*message:\s*error\.message\s*\}\)/g,
    /reply\.code\([^)]*\)\.send\(\{\s*error:\s*routeError\.error,\s*message:\s*routeError\.message\s*\}\)/g,
];

function getLineNumber(content, index) {
    return content.slice(0, index).split('\n').length;
}

async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
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
    const files = await walk(ROUTES_DIR);
    const violations = [];

    for (const filePath of files) {
        const relativePath = path.relative(API_ROOT, filePath);
        if (relativePath === 'routes/route-error.ts') {
            continue;
        }

        const content = await readFile(filePath, 'utf8');
        for (const pattern of INLINE_ERROR_PATTERNS) {
            pattern.lastIndex = 0;
            for (const match of content.matchAll(pattern)) {
                const index = match.index ?? 0;
                violations.push({
                    file: relativePath,
                    line: getLineNumber(content, index),
                    snippet: match[0],
                });
            }
        }
    }

    if (violations.length === 0) {
        console.log('Inline route error mapping check passed (use sendRouteError instead)');
        return;
    }

    console.error('Inline route error passthrough responses detected (use sendRouteError):');
    for (const violation of violations) {
        console.error(`- ${violation.file}:${violation.line}`);
        console.error(`  ${violation.snippet}`);
    }
    process.exitCode = 1;
}

await main();
