import { type FastifyInstance } from 'fastify';

/**
 * Sanitized error response for client consumption
 */
export interface SanitizedError {
    error: string;
    message: string;
    code?: string;
}

/**
 * Generic error messages to prevent information leakage
 */
const GENERIC_ERROR_MESSAGES = {
    AUTHENTICATION_ERROR: 'Authentication failed', AUTHORIZATION_ERROR: 'Access denied', INTERNAL_ERROR: 'An internal server error occurred', NOT_FOUND_ERROR: 'Resource not found', UPLOAD_ERROR: 'File upload failed', VALIDATION_ERROR: 'Invalid request data',
} as const;

/**
 * Sanitizes error messages for client responses while preserving server-side logging
 * @param error - The original error object
 * @param logger - Fastify logger instance for server-side logging
 * @param context - Additional context for logging (e.g., "upload", "auth")
 * @param errorCode - Optional error code for client response
 * @returns Sanitized error object safe for client consumption
 */
export function sanitizeError(
    error: unknown,
    logger: FastifyInstance['log'],
    context: string = 'general',
    errorCode?: string,
): SanitizedError {
    // Log the full error details server-side for debugging
    logger.error(
        {
            context, error: error instanceof Error ? error.stack : String(error),
        },
        `Error in ${context}`,
    );

    // Return generic error message to client
    const sanitizedMessage = GENERIC_ERROR_MESSAGES.INTERNAL_ERROR;

    return {
        error: 'Internal Server Error',
        message: sanitizedMessage,
        ...(errorCode && { code: errorCode }),
    };
}

/**
 * Creates a sanitized error for specific error types
 * @param errorType - Type of error from GENERIC_ERROR_MESSAGES
 * @param logger - Fastify logger instance
 * @param originalError - Original error for server-side logging
 * @param context - Context for logging
 * @param errorCode - Optional error code
 */
export function createSanitizedError(
    errorType: keyof typeof GENERIC_ERROR_MESSAGES,
    logger: FastifyInstance['log'],
    originalError?: unknown,
    context: string = 'general',
    errorCode?: string,
): SanitizedError {
    // Log original error if provided
    if (originalError) {
        logger.error(
            {
                context, error: originalError instanceof Error ? originalError.stack : String(originalError),
            },
            `Error in ${context}: ${errorType}`,
        );
    }

    return {
        error: errorType
            .replaceAll('_', ' ')
            .toLowerCase()
            .replaceAll(/\b\w/g, (l) => l.toUpperCase()),
        message: GENERIC_ERROR_MESSAGES[errorType],
        ...(errorCode && { code: errorCode }),
    };
}

/**
 * Type guard to check if error is a known validation error that can be safely exposed
 */
export function isValidationError(error: unknown): error is Error {
    return (
        error instanceof Error &&
        (error.message.includes('validation') || error.message.includes('schema') || error.message.includes('required'))
    );
}

/**
 * Safely extracts error message for validation errors only
 * @param error - The error object
 * @param logger - Fastify logger instance
 * @param context - Context for logging
 * @returns Safe error message for client or generic message
 */
export function getValidationErrorMessage(
    error: unknown,
    logger: FastifyInstance['log'],
    context: string = 'validation',
): string {
    if (isValidationError(error)) {
        // For validation errors, we can expose the message after sanitization
        const message = error.message
            .replaceAll(/\b(path|file|directory|server|internal|system)\b/gi, 'field')
            .replaceAll(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]') // Remove IP addresses
            .replaceAll(/\b[a-zA-Z]:[\\/ ].*?\b/g, '[PATH]'); // Remove file paths

        logger.warn({ context, error: error.stack }, `Validation error in ${context}`);
        return message;
    }

    // For non-validation errors, log and return generic message
    logger.error({ context, error: String(error) }, `Non-validation error in ${context}`);
    return GENERIC_ERROR_MESSAGES.VALIDATION_ERROR;
}
