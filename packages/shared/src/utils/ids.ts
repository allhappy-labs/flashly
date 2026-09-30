const random = (): string => Math.random().toString(16).slice(2, 10);

/**
 * Generate a unique ID using crypto.randomUUID() when available,
 * or falling back to a custom implementation.
 */
export function createId(): string {
    // Use crypto.randomUUID() in Node.js 18+, modern browsers, and React Native
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback implementation
    return `${Date.now().toString(16)}-${random()}-${random()}`;
}
