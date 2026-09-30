import type { QuizEnrichment } from '@flashly/shared/src';

export function claimQuizReviewRevision(revisions: Map<string, number>, cardId: string): number {
    const revision = (revisions.get(cardId) ?? 0) + 1;
    revisions.set(cardId, revision);
    return revision;
}

export function mergeGeneratedQuizReviews(
    current: ReadonlyMap<string, QuizEnrichment | null>,
    proposals: ReadonlyMap<string, QuizEnrichment>,
    requestRevisions: ReadonlyMap<string, number>,
    currentRevisions: ReadonlyMap<string, number>,
): Map<string, QuizEnrichment | null> {
    const merged = new Map(current);
    for (const [cardId, quiz] of proposals) {
        const requestRevision = requestRevisions.get(cardId) ?? 0;
        const currentRevision = currentRevisions.get(cardId) ?? 0;
        if (requestRevision === currentRevision) {
            merged.set(cardId, quiz);
        }
    }
    return merged;
}

export function updateQuizReview(
    current: ReadonlyMap<string, QuizEnrichment | null>,
    cardId: string,
    quiz: QuizEnrichment | null,
): Map<string, QuizEnrichment | null> {
    const next = new Map(current);
    next.set(cardId, quiz);
    return next;
}
