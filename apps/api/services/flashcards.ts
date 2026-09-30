import { generateFlashcardsWithOpenRouter } from '@flashly/shared';
import { config } from '../config/app.ts';
import { ConfigurationError, errorFactory, ExternalServiceError, NetworkError, ValidationError } from '@flashly/shared';
import type { FlashcardGenerationResult } from '@flashly/shared';
import { ResultAsync } from 'neverthrow';

export function generateFlashcards(prompt: string): ResultAsync<
    FlashcardGenerationResult,
    ConfigurationError | ExternalServiceError | ValidationError
> {
    if (!config.OPENROUTER_API_KEY) {
        return ResultAsync.fromPromise(
            Promise.reject(new Error('Missing API key')),
            () => errorFactory.configuration('OpenRouter API key is not configured.', {
                code: 'MISSING_API_KEY',
                context: { service: 'openrouter' },
            })
        );
    }

    return generateFlashcardsWithOpenRouter({
            apiKey: config.OPENROUTER_API_KEY,
            appName: config.OPENROUTER_APP_NAME,
            baseUrl: config.OPENROUTER_BASE_URL,
            model: config.OPENROUTER_MODEL,
            prompt,
            siteUrl: config.OPENROUTER_SITE_URL,
            timeoutMs: config.OPENROUTER_TIMEOUT_MS,
        })
        .mapErr((error) => {
            if (
                error instanceof ConfigurationError
                || error instanceof ExternalServiceError
                || error instanceof ValidationError
            ) {
                return error;
            }
            if (error instanceof NetworkError) {
                return new ExternalServiceError(error.message, 'openrouter', {
                    cause: error,
                });
            }
            return new ExternalServiceError('Unknown error occurred', 'openrouter', {
                cause: error,
            });
        });
}
