import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FlashcardResponseError } from '@flashly/shared/src';
import { generateFlashcardsWithProgress } from './flashcard-generation';

const mockStreamText = vi.fn();
const mockCreateOpenAI = vi.fn();
const mockOpenRouterModel = vi.fn();

vi.mock('ai', () => ({
    streamText: (...args: unknown[]) => mockStreamText(...args),
}));

vi.mock('@ai-sdk/openai', () => ({
    createOpenAI: (...args: unknown[]) => mockCreateOpenAI(...args),
}));

function createStream(chunks: string[]): AsyncIterable<string> {
    return {
        async *[Symbol.asyncIterator]() {
            for (const chunk of chunks) {
                yield chunk;
            }
        },
    };
}

describe('flashcard-generation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockOpenRouterModel.mockReturnValue('mock-model');
        mockCreateOpenAI.mockReturnValue(mockOpenRouterModel);
    });

    it('uses a single request when streamed output is parse-invalid', async () => {
        mockStreamText.mockResolvedValue({
            textStream: createStream(['I need source material first']),
            text: Promise.resolve('I need source material first'),
        });

        await expect(generateFlashcardsWithProgress({
            apiKey: 'test-key',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-5.2',
            prompt: 'Generate cards',
        })).rejects.toBeInstanceOf(FlashcardResponseError);

        expect(mockStreamText).toHaveBeenCalledTimes(1);
        expect(mockOpenRouterModel).toHaveBeenCalledTimes(1);
    });

    it('does not issue a second request when streaming transport fails', async () => {
        mockStreamText.mockRejectedValue(new Error('stream failed'));

        await expect(generateFlashcardsWithProgress({
            apiKey: 'test-key',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-5.2',
            prompt: 'Generate cards',
        })).rejects.toThrow('stream failed');

        expect(mockStreamText).toHaveBeenCalledTimes(1);
        expect(mockOpenRouterModel).toHaveBeenCalledTimes(1);
    });

    it('passes abortSignal to streamText and rejects on abort', async () => {
        const controller = new AbortController();
        const abortError = new Error('aborted');
        abortError.name = 'AbortError';
        mockStreamText.mockRejectedValue(abortError);

        await expect(generateFlashcardsWithProgress({
            apiKey: 'test-key',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-5.2',
            prompt: 'Generate cards',
            abortSignal: controller.signal,
        })).rejects.toThrow('aborted');

        expect(mockStreamText).toHaveBeenCalledTimes(1);
        expect(mockStreamText.mock.calls[0]?.[0]).toMatchObject({
            abortSignal: controller.signal,
        });
    });

    it('preserves valid optional quiz enrichment from streamed cards', async () => {
        const card = {
            front: 'Vater',
            back: 'father',
            quiz: {
                prompt: 'Which article belongs to Vater?',
                options: ['der', 'die', 'das'],
                correctAnswer: 'der',
                explanation: 'Vater is masculine.',
            },
        };
        mockStreamText.mockResolvedValue({
            textStream: createStream([JSON.stringify(card)]),
            text: Promise.resolve(JSON.stringify(card)),
        });

        const result = await generateFlashcardsWithProgress({
            apiKey: 'test-key',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-5.2',
            prompt: 'Generate cards',
        });

        expect(result.flashcards.flashcards).toEqual([card]);
    });
});
