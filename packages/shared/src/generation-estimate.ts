import { GENERATION_ESTIMATE, MATERIAL_TYPE_COMPLEXITY } from './constants';
import type { FlashcardMaterialType } from './index';

export type BatchEstimate = {
    durationSeconds: number;
    cardCount: number;
};

type GenerationTimingInput = {
    elapsedSeconds: number;
    estimatedSeconds: number | null;
    isGenerating: boolean;
    firstBatchEstimate: BatchEstimate | null;
    targetCardCount: number | null;
    generatedCount: number;
};

type GenerationTimingResult = {
    remainingSeconds: number | null;
    estimatedTotalSeconds: number | null;
};

// New input type for multi-factor estimation
export type MultiFactorEstimateInput = {
    textLength: number;
    cardCount: number;
    materialType: FlashcardMaterialType;
};

// Enhanced batch estimate with history
export type EnhancedBatchEstimate = {
    batches: BatchEstimate[];
    weightedAverageSecondsPerCard: number;
    sampleSize: number;
};

/**
 * Calculate initial estimate using multiple factors:
 * - Text/token length (base time)
 * - Card count (scales linearly beyond 10 cards)
 * - Material type complexity (1.0-1.5x multiplier)
 */
export function estimateGenerationSecondsMultiFactor(
    input: MultiFactorEstimateInput
): number | null {
    const { textLength, cardCount, materialType } = input;

    const normalizedCardCount = cardCount > 0 ? cardCount : GENERATION_ESTIMATE.BASE_CARD_COUNT;

    // Include a card-count-based token floor so empty source text still yields a usable estimate.
    const promptTokensFromText = Math.ceil(textLength / GENERATION_ESTIMATE.AVERAGE_CHARS_PER_TOKEN);
    const promptTokensFromCardCount = normalizedCardCount * 6;
    const promptTokens = Math.max(1, promptTokensFromText, promptTokensFromCardCount);
    const outputTokens = Math.max(20, Math.ceil(promptTokens * 0.35), normalizedCardCount * 24);
    const totalTokens = promptTokens + outputTokens;
    const baseSeconds = totalTokens / GENERATION_ESTIMATE.BASE_TOKENS_PER_SECOND;

    // Card count factor (1% increase per card beyond 10)
    const cardCountFactor = 1
        + Math.max(0, normalizedCardCount - GENERATION_ESTIMATE.BASE_CARD_COUNT) * GENERATION_ESTIMATE.CARD_COUNT_WEIGHT;

    // Material type complexity factor
    const materialFactor = MATERIAL_TYPE_COMPLEXITY[materialType] ?? 1.0;

    // Combined estimate
    const estimate = baseSeconds * cardCountFactor * materialFactor;

    return Math.min(
        GENERATION_ESTIMATE.MAX_ESTIMATE_SECONDS,
        Math.max(GENERATION_ESTIMATE.MIN_ESTIMATE_SECONDS, Math.ceil(estimate))
    );
}

/**
 * Calculate weighted average of batch timings.
 * Uses exponential weighting to stabilize quickly on recent data:
 * - First batch: 100% weight
 * - Second batch: 70% weight (weighted with first)
 * - Third batch: 50% weight
 * - Fourth+ batch: 30% weight (stabilizes on recent data)
 */
export function calculateWeightedBatchAverage(
    batches: BatchEstimate[]
): EnhancedBatchEstimate | null {
    if (batches.length === 0) return null;

    let weightedSum = 0;
    let weightSum = 0;

    batches.forEach((batch, index) => {
        const secondsPerCard = batch.cardCount > 0 ? batch.durationSeconds / batch.cardCount : 0;
        const weight = index === 0
            ? GENERATION_ESTIMATE.BATCH_WEIGHTS.FIRST
            : index === 1
                ? GENERATION_ESTIMATE.BATCH_WEIGHTS.SECOND
                : index === 2
                    ? GENERATION_ESTIMATE.BATCH_WEIGHTS.THIRD
                    : GENERATION_ESTIMATE.BATCH_WEIGHTS.STABLE;

        weightedSum += secondsPerCard * weight;
        weightSum += weight;
    });

    return {
        batches,
        weightedAverageSecondsPerCard: weightedSum / weightSum,
        sampleSize: batches.length,
    };
}

/**
 * Enhanced timing resolution with smooth transition from initial to batch estimate.
 * Blends initial estimate with batch estimate to avoid jumps:
 * - After 1st batch: 30% initial + 70% batch
 * - After 2nd batch: 10% initial + 90% batch
 * - After 3rd batch: 100% batch
 */
export function resolveEnhancedGenerationTiming(
    input: GenerationTimingInput & {
        enhancedBatchEstimate?: EnhancedBatchEstimate | null;
        batchNumber?: number;
    }
): GenerationTimingResult {
    const { remainingSeconds: remainingFromBatch } = resolveGenerationTiming(input);

    // If enhanced batch estimate exists, use it
    if (input.enhancedBatchEstimate && input.targetCardCount) {
        const { weightedAverageSecondsPerCard } = input.enhancedBatchEstimate;
        const remainingCards = Math.max(0, input.targetCardCount - input.generatedCount);

        if (remainingCards > 0 && weightedAverageSecondsPerCard > 0) {
            const enhancedRemaining = Math.ceil(weightedAverageSecondsPerCard * remainingCards);

            // Blend with initial estimate based on batch number
            const initialRemaining = input.estimatedSeconds === null
                ? null
                : Math.max(0, input.estimatedSeconds - input.elapsedSeconds);

            let blendFactor = 0;
            if (input.batchNumber === 1) blendFactor = 0.3;
            else if (input.batchNumber === 2) blendFactor = 0.1;
            else blendFactor = 0; // Full batch after 3rd

            const blendedRemaining = initialRemaining === null
                ? enhancedRemaining
                : Math.ceil(initialRemaining * blendFactor + enhancedRemaining * (1 - blendFactor));

            return {
                remainingSeconds: Math.max(0, blendedRemaining),
                estimatedTotalSeconds: input.elapsedSeconds + blendedRemaining,
            };
        }
    }

    // Fallback to original logic
    return {
        remainingSeconds: remainingFromBatch,
        estimatedTotalSeconds: input.estimatedSeconds,
    };
}

export function resolveGenerationTiming(input: GenerationTimingInput): GenerationTimingResult {
    const remainingSecondsFromText =
        input.estimatedSeconds === null ? null : Math.max(0, input.estimatedSeconds - input.elapsedSeconds);

    let remainingSecondsFromBatch: number | null = null;
    if (input.isGenerating && input.firstBatchEstimate && input.targetCardCount) {
        if (input.firstBatchEstimate.cardCount > 0) {
            const remainingCards = Math.max(0, input.targetCardCount - input.generatedCount);
            // Return null if no cards remaining (generation complete)
            if (remainingCards === 0) {
                remainingSecondsFromBatch = null;
            } else {
                const perCardSeconds = input.firstBatchEstimate.durationSeconds / input.firstBatchEstimate.cardCount;
                remainingSecondsFromBatch = Math.max(0, Math.ceil(perCardSeconds * remainingCards));
            }
        }
    }

    // Scale text estimate with progress before batch is available
    let scaledRemainingFromText = remainingSecondsFromText;
    if (input.isGenerating && !input.firstBatchEstimate && input.estimatedSeconds && input.generatedCount > 0) {
        // Use targetCardCount if available, otherwise assume we're generating towards the estimate
        const assumedTotal = input.targetCardCount ?? 20; // Reasonable default
        const progressRatio = input.generatedCount / Math.max(1, assumedTotal);
        scaledRemainingFromText = Math.max(0, Math.ceil(input.estimatedSeconds * (1 - progressRatio)));
    }

    const remainingSeconds = input.isGenerating
        ? remainingSecondsFromBatch ?? scaledRemainingFromText
        : remainingSecondsFromText;

    const estimatedTotalSeconds = input.isGenerating
        ? remainingSeconds === null
            ? null
            : input.elapsedSeconds + remainingSeconds
        : input.estimatedSeconds;

    return { remainingSeconds, estimatedTotalSeconds };
}
