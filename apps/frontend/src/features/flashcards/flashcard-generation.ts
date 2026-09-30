import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { type FlashcardsResponse } from '@flashly/shared/src';
import { createLogger } from '../../utils/logger';
import {
    parseFlashcardStreamLine,
    resolveStreamedFlashcards,
    splitStreamTextChunk,
} from './utils/flashcard-stream-parser';

const AVERAGE_CHARS_PER_TOKEN = 4;
const TOKENS_PER_SECOND = 24;
const MIN_ESTIMATE_SECONDS = 60;
const MAX_ESTIMATE_SECONDS = 90;
const streamLogger = createLogger('flashcard-stream', {
    debugEnabled: import.meta.env.DEV && import.meta.env.VITE_DEBUG_FLASHCARD_STREAM === 'true',
});

interface StreamOptions {
    apiKey: string;
    baseUrl: string;
    model: string;
    prompt: string;
    appName?: string;
    siteUrl?: string;
    timeoutMs?: number;
    onCardCount?: (count: number) => void;
    onCard?: (card: FlashcardsResponse['flashcards'][number], all: FlashcardsResponse['flashcards']) => void;
    abortSignal?: AbortSignal;
}

export async function generateFlashcardsWithProgress(options: StreamOptions): Promise<{
    flashcards: FlashcardsResponse;
    streamedCount: number;
}> {
    const openRouter = createOpenAI({
        apiKey: options.apiKey,
        baseURL: options.baseUrl,
        headers: {
            ...(options.siteUrl ? { 'HTTP-Referer': options.siteUrl } : {}),
            ...(options.appName ? { 'X-Title': options.appName } : {}),
        },
    });

    const cards: FlashcardsResponse['flashcards'] = [];
    let streamedCount = 0;
    let buffer = '';

    const handleLine = (line: string) => {
        const result = parseFlashcardStreamLine(line);

        if (result.kind === 'empty') {
            return;
        }

        if (result.kind === 'parsed') {
            streamLogger.debug('Parsed card:', result.card.front?.substring(0, 30));
            cards.push(result.card);
            streamedCount = cards.length;
            options.onCardCount?.(streamedCount);
            options.onCard?.(result.card, [...cards]);
            return;
        }

        if (result.kind === 'invalid-schema') {
            streamLogger.warn('Schema validation failed');
            streamLogger.warn('Zod errors:', result.formattedError);
            return;
        }

        streamLogger.error('JSON parse failed:', result.error);
        streamLogger.error('Line that failed:', result.preview);
    };

    try {
        const result = await streamText({
            model: openRouter(options.model) as Parameters<typeof streamText>[0]['model'],
            prompt: options.prompt,
            abortSignal: options.abortSignal,
        });

        for await (const chunk of result.textStream) {
            const parsedChunk = splitStreamTextChunk(buffer, chunk);
            buffer = parsedChunk.buffer;
            for (const line of parsedChunk.lines) {
                handleLine(line);
            }
        }
        if (buffer.trim()) {
            handleLine(buffer);
        }

        const text = await result.text;
        streamLogger.debug('Stream complete, total text length:', text.length);
        streamLogger.debug('Cards collected during stream:', cards.length);
        const fallback = resolveStreamedFlashcards(cards, text);
        return {
            flashcards: fallback,
            streamedCount: Math.max(streamedCount, fallback.flashcards.length),
        };
    } catch (error) {
        streamLogger.error('Flashcard generation stream failed', error);
        throw error;
    }
}

export function estimateGenerationSeconds(text: string): number | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const promptTokens = Math.max(1, Math.ceil(trimmed.length / AVERAGE_CHARS_PER_TOKEN));
    const outputTokens = Math.max(20, Math.ceil(promptTokens * 0.35));
    const totalTokens = promptTokens + outputTokens;
    const estimate = Math.ceil(totalTokens / TOKENS_PER_SECOND);

    return Math.min(MAX_ESTIMATE_SECONDS, Math.max(MIN_ESTIMATE_SECONDS, estimate));
}

export function formatDuration(seconds: number | null): string {
    if (seconds === null) return '--';
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remaining = safeSeconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${remaining}s`;
    }
    return `${remaining}s`;
}
