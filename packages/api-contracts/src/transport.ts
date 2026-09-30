import { z } from 'zod';

export const TRPC_BYPASS_PATH_PREFIXES = ['/api/auth', '/api/upload', '/api/flashcards'] as const;
const DISALLOWED_PATH_ENCODING_PATTERN = /%2e|%2f|%5c/i;
const DOT_SEGMENT_PATTERN = /(?:^|\/)\.{1,2}(?:\/|$)/;

const QueryValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const TransportMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export const TransportHeadersSchema = z.record(z.string(), z.string()).optional();

export const TransportRequestSchema = z.object({
  body: z.unknown().optional(),
  headers: TransportHeadersSchema,
  method: TransportMethodSchema,
  path: z.string().min(1),
  query: z.record(z.string(), z.union([QueryValueSchema, z.array(QueryValueSchema)])).optional(),
});

export type TransportRequest = z.infer<typeof TransportRequestSchema>;

export function normalizeApiPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function canonicalizeApiPath(path: string): string {
  const normalized = normalizeApiPath(path);
  const url = new URL(`http://local${normalized}`);
  return url.pathname;
}

export function isUnsafeApiPath(path: string): boolean {
  const normalized = normalizeApiPath(path);

  if (normalized.includes('?') || normalized.includes('#')) {
    return true;
  }

  if (DISALLOWED_PATH_ENCODING_PATTERN.test(normalized)) {
    return true;
  }

  let decodedPath = normalized;
  try {
    decodedPath = decodeURIComponent(normalized);
  } catch {
    return true;
  }

  return DOT_SEGMENT_PATTERN.test(decodedPath);
}

export function shouldBypassTrpc(path: string): boolean {
  const canonicalPath = canonicalizeApiPath(path);
  return TRPC_BYPASS_PATH_PREFIXES.some((prefix) => canonicalPath.startsWith(prefix));
}

export function buildPathWithQuery(path: string, query?: TransportRequest['query']): string {
  const normalized = canonicalizeApiPath(path);
  if (!query) {
    return normalized;
  }

  const url = new URL(`http://local${normalized}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) {
          continue;
        }
        url.searchParams.append(key, String(item));
      }
      continue;
    }

    if (value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return `${url.pathname}${url.search}`;
}

export function parsePath(pathWithOptionalQuery: string): {
  path: string;
  query: Record<string, string | string[]>;
} {
  const normalized = normalizeApiPath(pathWithOptionalQuery);
  const url = new URL(`http://local${normalized}`);
  const query: Record<string, string | string[]> = {};

  for (const key of url.searchParams.keys()) {
    const values = url.searchParams.getAll(key);
    query[key] = values.length <= 1 ? values[0] ?? '' : values;
  }

  return {
    path: url.pathname,
    query,
  };
}
