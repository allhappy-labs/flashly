/**
 * Type-safe DOM helpers to avoid type casts
 */

/**
 * Get a form element with type safety
 */
export function getFormElement(selector: string): HTMLFormElement | null {
    const element = document.querySelector(selector);
    return element instanceof HTMLFormElement ? element : null;
}

/**
 * Get a form element or throw an error
 */
export function requireFormElement(selector: string): HTMLFormElement {
    const element = getFormElement(selector);
    if (!element) {
        throw new Error(`Form element not found: ${selector}`);
    }
    return element;
}
