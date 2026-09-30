import type { ResultAsync} from 'neverthrow';
import { okAsync, errAsync } from 'neverthrow';
import { z } from 'zod';
import { parseFlashcardsResponse, type OpenRouterUsage, type FlashcardGenerationResult } from './flashcards';
import {
    ValidationError,
    ExternalServiceError,
    NetworkError,
    ConfigurationError,
    safeAsync,
} from './errors';

export interface OpenRouterRequestOptions {
    apiKey: string;
    baseUrl: string;
    model: string;
    prompt: string;
    timeoutMs?: number;
    appName?: string;
    siteUrl?: string;
    fetchImpl?: typeof fetch;
}

interface OpenRouterResponsePayload {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: OpenRouterUsage;
    error?: { message?: string };
}

// Zod schema for validating OpenRouter response
const OpenRouterResponseSchema = z.object({
    choices: z.array(z.object({
        message: z.object({
            content: z.string().optional(),
        }).optional(),
    })).optional(),
    model: z.string().optional(),
    usage: z.object({
        prompt_tokens: z.number().optional(),
        completion_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
    }).optional(),
    error: z.object({
        message: z.string().optional(),
    }).optional(),
});

/**
 * Generate flashcards using OpenRouter API with neverthrow Result types
 */
export function generateFlashcardsWithOpenRouter(
    options: OpenRouterRequestOptions,
): ResultAsync<FlashcardGenerationResult, ValidationError | ExternalServiceError | NetworkError | ConfigurationError> {
    // Check for fetch implementation
    const fetchFn = options.fetchImpl ?? globalThis.fetch;
    if (!fetchFn) {
        return errAsync(
            new ConfigurationError('Fetch is not available in this environment.', {
                context: { code: 'MISSING_FETCH' },
            })
        );
    }

    // Check for API key
    if (!options.apiKey) {
        return errAsync(
            new ConfigurationError('OpenRouter API key is not configured.', {
                context: { code: 'MISSING_API_KEY', service: 'openrouter' },
            })
        );
    }

    // Set up timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);

    // Build request
    const request = fetchFn(`${options.baseUrl}/chat/completions`, {
        body: JSON.stringify({
            messages: [
                {
                    content:
                        'Return only valid JSONL (one JSON object per line for flashcards) or a single JSON error object: {"error":{"code":"INSUFFICIENT_SOURCE","message":"..."}}.',
                    role: 'system',
                },
                {
                    content: options.prompt,
                    role: 'user',
                },
            ],
            model: options.model,
            temperature: 0.2,
        }),
        headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
            ...(options.siteUrl ? { 'HTTP-Referer': options.siteUrl } : {}),
            ...(options.appName ? { 'X-Title': options.appName } : {}),
        },
        method: 'POST',
        signal: controller.signal,
    });

    // Execute request with error handling
    return safeAsync(request, (error) => {
        clearTimeout(timeout);
        if (error instanceof Error && error.name === 'AbortError') {
            return new NetworkError('OpenRouter request timed out', { cause: error });
        }
        return new NetworkError(
            `Failed to connect to OpenRouter: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { cause: error }
        );
    })
        .andThen((response) => {
            clearTimeout(timeout);

            // Parse JSON response
            return safeAsync(
                response.json(),
                (error) => new ValidationError('Failed to parse OpenRouter response', { cause: error })
            ).andThen((unknown): ResultAsync<OpenRouterResponsePayload, ValidationError> => {
                // Validate the response structure using Zod
                const result = OpenRouterResponseSchema.safeParse(unknown);
                if (!result.success) {
                    const errorMessages = result.error.issues.map((issue) => {
                        const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
                        return `${path}: ${issue.message}`;
                    }).join(', ');
                    return errAsync(
                        new ValidationError('Invalid OpenRouter response structure', {
                            cause: new Error(errorMessages)
                        })
                    );
                }
                return okAsync(result.data);
            });
        })
        .andThen((payload) => {
            // Check for API errors
            if (payload.error?.message) {
                return errAsync(
                    new ExternalServiceError(
                        `OpenRouter API error: ${payload.error.message}`,
                        'openrouter',
                        { context: { error: payload.error } }
                    )
                );
            }

            // Extract content
            const content = payload.choices?.[0]?.message?.content;
            if (!content) {
                return errAsync(
                    new ExternalServiceError(
                        'OpenRouter returned an empty response',
                        'openrouter'
                    )
                );
            }

            // Parse flashcards
            try {
                const parsed = parseFlashcardsResponse(content);
                return okAsync({
                    flashcards: parsed,
                    model: payload.model ?? options.model,
                    usage: payload.usage,
                });
            } catch (error) {
                return errAsync(
                    new ValidationError(
                        `Failed to parse flashcards from OpenRouter response: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        { cause: error }
                    )
                );
            }
        });
}
