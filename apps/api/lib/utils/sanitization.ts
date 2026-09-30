/**
 * Sanitization utilities for preventing injection attacks.
 */

/**
 * Sanitizes user input for email headers by removing newline characters.
 * Prevents email header injection attacks (RFC 5322).
 *
 * @param input - User input to sanitize
 * @returns Sanitized string with newlines replaced by spaces
 *
 * @example
 * ```ts
 * sanitizeEmailHeader("John\\nBcc: victim@example.com")
 * // Returns: "John Bcc: victim@example.com"
 * ```
 */
export function sanitizeEmailHeader(input: string): string {
    return input
        .replace(/\r\n|\n|\r/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim(); // Remove leading/trailing whitespace
}

/**
 * Sanitizes input for email subject lines with length limits.
 * RFC 5322 recommends email headers be no more than 998 characters.
 *
 * @param input - User input to sanitize for email subject
 * @returns Sanitized string safe for use in email subjects
 *
 * @example
 * ```ts
 * sanitizeEmailSubject("John\\r\\nSubject: Spam")
 * // Returns: "John Subject: Spam"
 * ```
 */
export function sanitizeEmailSubject(input: string): string {
    return sanitizeEmailHeader(input).substring(0, 998); // RFC 5322 limit
}
