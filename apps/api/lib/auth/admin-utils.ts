/**
 * Admin Authorization Utilities
 *
 * Provides helper functions for checking admin permissions
 */

/**
 * Check if a user has admin role
 * @param user - User object with optional role property
 * @returns true if user is an admin, false otherwise
 */
export function isAdmin(user: unknown): boolean {
    if (!user || typeof user !== 'object') {
        return false;
    }
    const role = 'role' in user ? (user as { role?: string | null }).role : undefined;
    return role === 'admin';
}

/**
 * Require admin access - throws error if not admin
 * Use this in routes that require admin authorization
 */
export function requireAdmin(user: unknown): void {
    if (!isAdmin(user)) {
        throw new Error('FORBIDDEN');
    }
}
