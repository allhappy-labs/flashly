import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import {
    buildQuizEnrichmentPrompt,
    QuizEnrichmentProposalSchema,
    type QuizEnrichmentProposal,
    type QuizEnrichmentSourceCard,
} from '@flashly/shared/src';
import { splitStreamTextChunk } from './utils/flashcard-stream-parser';

export const QUIZ_ENRICHMENT_BATCH_SIZE = 50;

type OnProposal = (
    proposal: QuizEnrichmentProposal,
    proposals: QuizEnrichmentProposal[],
) => void;

export type QuizEnrichmentStreamOptions = Readonly<{
    apiKey: string;
    baseUrl: string;
    model: string;
    prompt: string;
    appName?: string;
    siteUrl?: string;
    onProposal?: OnProposal;
    abortSignal?: AbortSignal;
    allowedCardIds?: ReadonlySet<string>;
}>;

export type QuizEnrichmentBatchOptions = Readonly<{
    apiKey: string;
    baseUrl: string;
    model: string;
    cards: readonly QuizEnrichmentSourceCard[];
    instruction?: string;
    batchSize?: number;
    appName?: string;
    siteUrl?: string;
    onProposal?: OnProposal;
    abortSignal?: AbortSignal;
}>;

export type QuizEnrichmentGenerationResult = Readonly<{
    proposals: QuizEnrichmentProposal[];
    invalidCount: number;
    omittedCardIds: string[];
}>;

export class QuizEnrichmentPartialFailure extends Error {
    readonly result: QuizEnrichmentGenerationResult;

    constructor(error: unknown, result: QuizEnrichmentGenerationResult) {
        super(error instanceof Error ? error.message : 'Quiz enrichment generation failed.');
        this.name = 'QuizEnrichmentPartialFailure';
        this.result = result;
    }
}

export function getQuizEnrichmentPartialResult(error: unknown): QuizEnrichmentGenerationResult | undefined {
    return error instanceof QuizEnrichmentPartialFailure ? error.result : undefined;
}

function parseProposalLine(line: string): QuizEnrichmentProposal | undefined {
    const trimmed = line.trim();
    if (!trimmed) {
        return undefined;
    }

    try {
        return QuizEnrichmentProposalSchema.safeParse(JSON.parse(trimmed)).data;
    } catch {
        return undefined;
    }
}

function createAbortError(): Error {
    const error = new Error('Operation aborted');
    error.name = 'AbortError';
    return error;
}

function throwIfAborted(abortSignal?: AbortSignal): void {
    if (abortSignal?.aborted) {
        throw createAbortError();
    }
}

export async function generateQuizEnrichmentsWithProgress(
    options: QuizEnrichmentStreamOptions,
): Promise<QuizEnrichmentGenerationResult> {
    const openRouter = createOpenAI({
        apiKey: options.apiKey,
        baseURL: options.baseUrl,
        headers: {
            ...(options.siteUrl ? { 'HTTP-Referer': options.siteUrl } : {}),
            ...(options.appName ? { 'X-Title': options.appName } : {}),
        },
    });
    const proposalsByCardId = new Map<string, QuizEnrichmentProposal>();
    let invalidCount = 0;
    let buffer = '';

    const handleLine = (line: string) => {
        if (!line.trim()) {
            return;
        }
        const proposal = parseProposalLine(line);
        if (!proposal) {
            invalidCount += 1;
            return;
        }
        if (options.allowedCardIds && !options.allowedCardIds.has(proposal.cardId)) {
            invalidCount += 1;
            return;
        }
        proposalsByCardId.set(proposal.cardId, proposal);
        options.onProposal?.(proposal, Array.from(proposalsByCardId.values()));
    };

    const result = await streamText({
        model: openRouter(options.model),
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
    await result.text;

    return {
        proposals: Array.from(proposalsByCardId.values()),
        invalidCount,
        omittedCardIds: options.allowedCardIds
            ? Array.from(options.allowedCardIds).filter((cardId) => !proposalsByCardId.has(cardId))
            : [],
    };
}

export async function generateQuizEnrichmentBatchesWithProgress(
    options: QuizEnrichmentBatchOptions,
): Promise<QuizEnrichmentGenerationResult> {
    const proposalsByCardId = new Map<string, QuizEnrichmentProposal>();
    const batchSize = Math.max(1, Math.floor(options.batchSize ?? QUIZ_ENRICHMENT_BATCH_SIZE));
    let invalidCount = 0;

    for (let start = 0; start < options.cards.length; start += batchSize) {
        throwIfAborted(options.abortSignal);
        const cards = options.cards.slice(start, start + batchSize);
        const allowedCardIds = new Set(cards.map((card) => card.id));
        let result: QuizEnrichmentGenerationResult;
        try {
            result = await generateQuizEnrichmentsWithProgress({
                apiKey: options.apiKey,
                baseUrl: options.baseUrl,
                model: options.model,
                prompt: buildQuizEnrichmentPrompt(cards, options.instruction),
                appName: options.appName,
                siteUrl: options.siteUrl,
                abortSignal: options.abortSignal,
                allowedCardIds,
                onProposal: (proposal) => {
                    proposalsByCardId.set(proposal.cardId, proposal);
                    options.onProposal?.(proposal, Array.from(proposalsByCardId.values()));
                },
            });
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw error;
            }
            throw new QuizEnrichmentPartialFailure(error, {
                proposals: Array.from(proposalsByCardId.values()),
                invalidCount,
                omittedCardIds: options.cards
                    .map((card) => card.id)
                    .filter((cardId) => !proposalsByCardId.has(cardId)),
            });
        }
        invalidCount += result.invalidCount;
        for (const proposal of result.proposals) {
            proposalsByCardId.set(proposal.cardId, proposal);
        }
        throwIfAborted(options.abortSignal);
    }

    return {
        proposals: Array.from(proposalsByCardId.values()),
        invalidCount,
        omittedCardIds: options.cards
            .map((card) => card.id)
            .filter((cardId) => !proposalsByCardId.has(cardId)),
    };
}
