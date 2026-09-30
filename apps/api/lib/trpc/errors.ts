import { AppError } from '@flashly/shared';
import { TRPCError } from '@trpc/server';

function statusToCode(statusCode: number): TRPCError['code'] {
  if (statusCode === 400) return 'BAD_REQUEST';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  if (statusCode === 429) return 'TOO_MANY_REQUESTS';
  if (statusCode === 405) return 'METHOD_NOT_SUPPORTED';
  return 'INTERNAL_SERVER_ERROR';
}

export function toTrpcError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof AppError) {
    const isServerError = error.statusCode >= 500;
    return new TRPCError({
      cause: error,
      code: statusToCode(error.statusCode),
      message: isServerError ? 'Internal server error' : error.message,
    });
  }

  if (error instanceof Error) {
    return new TRPCError({
      cause: error,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  }

  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unknown error',
  });
}

export function createStatusError(statusCode: number, message: string, cause?: unknown): TRPCError {
  const normalizedCause =
    typeof cause === 'object' && cause !== null
      ? { statusCode, ...(cause as Record<string, unknown>) }
      : { cause, statusCode };

  return new TRPCError({
    cause: normalizedCause,
    code: statusToCode(statusCode),
    message,
  });
}
