import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    generateQuizEnrichmentBatchesWithProgress,
    generateQuizEnrichmentsWithProgress,
} from './quiz-enrichment-generation';

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

const firstProposal = {
    cardId: 'card-1',
    quiz: {
        prompt: 'Which article belongs to Vater?',
        options: ['der', 'die', 'das'],
        correctAnswer: 'der',
        explanation: 'Vater is masculine.',
    },
};

const secondProposal = {
    cardId: 'card-2',
    quiz: {
        prompt: 'What does Haus mean?',
        options: ['house', 'mouse', 'horse'],
        correctAnswer: 'house',
        explanation: 'Haus translates to house.',
    },
};

describe('quiz-enrichment-generation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStreamText.mockReset();
        mockOpenRouterModel.mockReturnValue('mock-model');
        mockCreateOpenAI.mockReturnValue(mockOpenRouterModel);
    });

    it('emits valid proposals progressively', async () => {
        mockStreamText.mockResolvedValue({
            textStream: createStream([
                `${JSON.stringify(firstProposal)}\n`,
                `${JSON.stringify(secondProposal)}\n`,
            ]),
            text: Promise.resolve(`${JSON.stringify(firstProposal)}\n${JSON.stringify(secondProposal)}`),
        });
        const onProposal = vi.fn();

        const result = await generateQuizEnrichmentsWithProgress({
            apiKey: 'test-key',
            appName: 'Flashly',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-5.2',
            onProposal,
            prompt: 'Generate quiz enrichments',
            siteUrl: 'https://flashly.test',
        });

        expect(onProposal).toHaveBeenNthCalledWith(1, firstProposal, [firstProposal]);
        expect(onProposal).toHaveBeenNthCalledWith(2, secondProposal, [firstProposal, secondProposal]);
        expect(result).toEqual({
            proposals: [firstProposal, secondProposal],
            invalidCount: 0,
            omittedCardIds: [],
        });
        expect(mockCreateOpenAI).toHaveBeenCalledWith({
            apiKey: 'test-key',
            baseURL: 'https://openrouter.ai/api/v1',
            headers: {
                'HTTP-Referer': 'https://flashly.test',
                'X-Title': 'Flashly',
            },
        });
    });

    it('keeps valid proposals when another proposal is invalid', async () => {
        const invalidProposal = {
            cardId: 'invalid-card',
            quiz: {
                ...firstProposal.quiz,
                options: ['der', 'der'],
            },
        };
        mockStreamText.mockResolvedValue({
            textStream: createStream([
                `${JSON.stringify(firstProposal)}\n${JSON.stringify(invalidProposal)}\n${JSON.stringify(secondProposal)}`,
            ]),
            text: Promise.resolve(''),
        });

        const result = await generateQuizEnrichmentsWithProgress({
            apiKey: 'test-key',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-5.2',
            prompt: 'Generate quiz enrichments',
        });

        expect(result).toEqual({
            proposals: [firstProposal, secondProposal],
            invalidCount: 1,
            omittedCardIds: [],
        });
    });

    it('keeps the last valid proposal for a card', async () => {
        const replacementProposal = {
            ...firstProposal,
            quiz: {
                ...firstProposal.quiz,
                explanation: 'The noun Vater is masculine.',
            },
        };
        mockStreamText.mockResolvedValue({
            textStream: createStream([
                `${JSON.stringify(firstProposal)}\n${JSON.stringify(replacementProposal)}\n`,
            ]),
            text: Promise.resolve(''),
        });

        const result = await generateQuizEnrichmentsWithProgress({
            apiKey: 'test-key',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-5.2',
            prompt: 'Generate quiz enrichments',
        });

        expect(result).toEqual({
            proposals: [replacementProposal],
            invalidCount: 0,
            omittedCardIds: [],
        });
    });

    it('ignores proposals for card IDs outside the canonical source set', async () => {
        const unknownProposal = {
            ...secondProposal,
            cardId: 'hallucinated-card',
        };
        mockStreamText.mockResolvedValue({
            textStream: createStream([
                `${JSON.stringify(firstProposal)}\n${JSON.stringify(unknownProposal)}\n`,
            ]),
            text: Promise.resolve(''),
        });
        const onProposal = vi.fn();

        const result = await generateQuizEnrichmentsWithProgress({
            apiKey: 'test-key',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-5.2',
            prompt: 'Generate quiz enrichments',
            allowedCardIds: new Set(['card-1']),
            onProposal,
        });

        expect(onProposal).toHaveBeenCalledOnce();
        expect(onProposal).toHaveBeenCalledWith(firstProposal, [firstProposal]);
        expect(result).toEqual({
            proposals: [firstProposal],
            invalidCount: 1,
            omittedCardIds: [],
        });
    });

    it('reports requested canonical cards omitted by malformed or unknown output', async () => {
        const malformedProposal = {
            cardId: 'card-2',
            quiz: {
                ...secondProposal.quiz,
                options: ['house', 'house'],
            },
        };
        const unknownProposal = {
            ...secondProposal,
            cardId: 'unknown-card',
        };
        mockStreamText.mockResolvedValue({
            textStream: createStream([
                `${JSON.stringify(firstProposal)}\n${JSON.stringify(malformedProposal)}\n${JSON.stringify(unknownProposal)}\n`,
            ]),
            text: Promise.resolve(''),
        });

        const result = await generateQuizEnrichmentBatchesWithProgress({
            apiKey: 'test-key',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-5.2',
            cards: [
                { id: 'card-1', front: 'Vater', back: 'father' },
                { id: 'card-2', front: 'Haus', back: 'house' },
                { id: 'card-3', front: 'Baum', back: 'tree' },
            ],
        });

        expect(result).toEqual({
            proposals: [firstProposal],
            invalidCount: 2,
            omittedCardIds: ['card-2', 'card-3'],
        });
    });

    it('merges proposals from bounded source-card batches', async () => {
        mockStreamText
            .mockResolvedValueOnce({
                textStream: createStream([`${JSON.stringify(firstProposal)}\n`]),
                text: Promise.resolve(''),
            })
            .mockResolvedValueOnce({
                textStream: createStream([`${JSON.stringify(secondProposal)}\n`]),
                text: Promise.resolve(''),
            });
        const onProposal = vi.fn();

        const result = await generateQuizEnrichmentBatchesWithProgress({
            apiKey: 'test-key',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-5.2',
            cards: [
                { id: 'card-1', front: 'Vater', back: 'father' },
                { id: 'card-2', front: 'Haus', back: 'house' },
            ],
            batchSize: 1,
            onProposal,
        });

        expect(mockStreamText).toHaveBeenCalledTimes(2);
        expect(onProposal).toHaveBeenNthCalledWith(1, firstProposal, [firstProposal]);
        expect(onProposal).toHaveBeenNthCalledWith(2, secondProposal, [firstProposal, secondProposal]);
        expect(result).toEqual({
            proposals: [firstProposal, secondProposal],
            invalidCount: 0,
            omittedCardIds: [],
        });
    });

    it('retains earlier batch proposals and reports every other requested card when a later batch fails', async () => {
        const providerError = new Error('Provider unavailable');
        mockStreamText
            .mockResolvedValueOnce({
                textStream: createStream([`${JSON.stringify(firstProposal)}\n`]),
                text: Promise.resolve(''),
            })
            .mockRejectedValueOnce(providerError);

        let failure: unknown;
        try {
            await generateQuizEnrichmentBatchesWithProgress({
                apiKey: 'test-key',
                baseUrl: 'https://openrouter.ai/api/v1',
                model: 'openai/gpt-5.2',
                cards: [
                    { id: 'card-1', front: 'Vater', back: 'father' },
                    { id: 'card-2', front: 'Haus', back: 'house' },
                    { id: 'card-3', front: 'Baum', back: 'tree' },
                ],
                batchSize: 1,
            });
        } catch (error) {
            failure = error;
        }

        expect(failure).toMatchObject({
            name: 'QuizEnrichmentPartialFailure',
            result: {
                proposals: [firstProposal],
                invalidCount: 0,
                omittedCardIds: ['card-2', 'card-3'],
            },
        });
        expect(mockStreamText).toHaveBeenCalledTimes(2);
    });

    it('stops before starting the next batch after cancellation', async () => {
        const controller = new AbortController();
        mockStreamText.mockResolvedValue({
            textStream: createStream([`${JSON.stringify(firstProposal)}\n`]),
            text: Promise.resolve(''),
        });

        await expect(generateQuizEnrichmentBatchesWithProgress({
            apiKey: 'test-key',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-5.2',
            cards: [
                { id: 'card-1', front: 'Vater', back: 'father' },
                { id: 'card-2', front: 'Haus', back: 'house' },
            ],
            batchSize: 1,
            abortSignal: controller.signal,
            onProposal: () => controller.abort(),
        })).rejects.toMatchObject({ name: 'AbortError' });

        expect(mockStreamText).toHaveBeenCalledTimes(1);
    });

    it('propagates aborts without applying proposals', async () => {
        const controller = new AbortController();
        const abortError = new Error('aborted');
        abortError.name = 'AbortError';
        mockStreamText.mockRejectedValue(abortError);
        const onProposal = vi.fn();

        await expect(generateQuizEnrichmentsWithProgress({
            apiKey: 'test-key',
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-5.2',
            onProposal,
            prompt: 'Generate quiz enrichments',
            abortSignal: controller.signal,
        })).rejects.toThrow('aborted');

        expect(onProposal).not.toHaveBeenCalled();
        expect(mockStreamText.mock.calls[0]?.[0]).toMatchObject({
            abortSignal: controller.signal,
        });
    });
});
