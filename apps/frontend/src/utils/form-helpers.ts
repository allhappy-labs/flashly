/**
 * Type-safe FormData helpers to avoid type casts
 */

/**
 * Get a string value from FormData, returning empty string if not found
 */
export function getFormString(formData: FormData, key: string): string {
    const value = formData.get(key);
    return value?.toString() ?? '';
}

/**
 * Get a value from FormData, returning null if not found
 */
export function getFormValue(formData: FormData, key: string): string | null {
    const value = formData.get(key);
    return value ? value.toString() : null;
}
