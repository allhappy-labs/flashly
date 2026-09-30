/**
 * Type-safe file helpers to avoid type casts
 */

/**
 * Type guard to check if FileReader result is a string
 */
export function isFileReaderResultString(
    result: string | ArrayBuffer | null,
): result is string {
    return typeof result === 'string';
}

/**
 * Get FileReader result as string safely
 */
export function getFileReaderResultAsString(
    result: string | ArrayBuffer | null,
): string | null {
    return isFileReaderResultString(result) ? result : null;
}
