import type { FastifyReply } from 'fastify';
import { z } from 'zod';

export type RouteErrorEnvelope = {
  error: string;
  message: string;
};

export const routeErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});

type RouteErrorOverrides = {
  statusByCode?: Readonly<Record<string, number>>;
  statusByMessage?: Readonly<Record<string, number>>;
  codeByMessage?: Readonly<Record<string, string>>;
  codeByStatus?: Readonly<Record<number, string>>;
};

export type RouteErrorOptions = RouteErrorOverrides & {
  allowedStatuses?: readonly number[];
  defaultStatus?: number;
  fallbackCode?: string;
  fallbackMessage?: string;
};

function getObjectProperty(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  return Reflect.get(value, key);
}

function getStringProperty(value: unknown, key: string): string | undefined {
  const candidate = getObjectProperty(value, key);
  return typeof candidate === 'string' ? candidate : undefined;
}

function getNumberProperty(value: unknown, key: string): number | undefined {
  const candidate = getObjectProperty(value, key);
  return typeof candidate === 'number' ? candidate : undefined;
}

export function getRouteErrorCode(error: unknown, fallbackCode: string = 'INTERNAL_ERROR'): string {
  return getStringProperty(error, 'code') ?? fallbackCode;
}

export function getRouteErrorMessage(
  error: unknown,
  fallbackMessage: string = 'An unexpected error occurred',
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return getStringProperty(error, 'message') ?? fallbackMessage;
}

function resolveRouteErrorStatus(error: unknown, options: RouteErrorOptions): number {
  const code = getRouteErrorCode(error, options.fallbackCode);
  const message = getRouteErrorMessage(error, options.fallbackMessage);
  const overrideStatusByCode = options.statusByCode?.[code];
  if (overrideStatusByCode !== undefined) {
    return overrideStatusByCode;
  }

  const overrideStatusByMessage = options.statusByMessage?.[message];
  if (overrideStatusByMessage !== undefined) {
    return overrideStatusByMessage;
  }

  return getNumberProperty(error, 'statusCode') ?? (options.defaultStatus ?? 500);
}

export function sendRouteError(
  reply: FastifyReply,
  error: unknown,
  options: RouteErrorOptions = {},
): FastifyReply {
  const defaultStatus = options.defaultStatus ?? 500;
  let status = resolveRouteErrorStatus(error, options);

  if (options.allowedStatuses && !options.allowedStatuses.includes(status)) {
    status = defaultStatus;
  }

  const message = getRouteErrorMessage(error, options.fallbackMessage);
  const messageCode = options.codeByMessage?.[message];
  const statusCode = options.codeByStatus?.[status];
  const code = messageCode ?? statusCode ?? getRouteErrorCode(error, options.fallbackCode);

  return reply.code(status).send({ error: code, message });
}
