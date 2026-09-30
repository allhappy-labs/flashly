import type { MediaFailure } from '@flashly/shared/src';

export function createFailureLookupMap(failures: readonly MediaFailure[]): Map<string, MediaFailure> {
    const lookup = new Map<string, MediaFailure>();
    for (const failure of failures) {
        if (!lookup.has(failure.cardId)) {
            lookup.set(failure.cardId, failure);
        }
    }
    return lookup;
}
