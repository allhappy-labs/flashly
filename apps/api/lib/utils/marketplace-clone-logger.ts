import type { FastifyBaseLogger } from 'fastify';

type CloneLogContext = {
    requestId?: string;
    deckId: string;
    userId: string;
};

function serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        const cause = (error as Error & { cause?: unknown }).cause;
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            cause: cause instanceof Error
                ? {
                    name: cause.name,
                    message: cause.message,
                    stack: cause.stack,
                }
                : cause ?? null,
        };
    }

    return {
        value: error,
    };
}

export function createMarketplaceCloneLogger(
    logger: FastifyBaseLogger,
    context: CloneLogContext
) {
    return logger.child({
        feature: 'marketplace_clone',
        requestId: context.requestId,
        deckId: context.deckId,
        userId: context.userId,
    });
}

export function logMarketplaceCloneStart(logger: FastifyBaseLogger): void {
    logger.info('Marketplace clone request started');
}

export function logMarketplaceCloneSuccess(
    logger: FastifyBaseLogger,
    clonedDeckId: string
): void {
    logger.info({ clonedDeckId }, 'Marketplace clone request completed');
}

export function logMarketplaceCloneFailure(
    logger: FastifyBaseLogger,
    error: unknown
): void {
    logger.error(
        {
            error: serializeError(error),
        },
        'Marketplace clone request failed'
    );
}
