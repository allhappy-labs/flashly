import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authClient } from '@/features/auth/auth-client';
// Better auth types
export interface User {
    id: string;
    email: string;
    name?: string;
    image?: string | null;
    emailVerified?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    username?: string;
    role?: string | null;
    isAdmin?: boolean;
}

interface Session {
    id: string;
    userId: string;
    expiresAt: Date;
    token?: string;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    loginWithMagicLink: (email: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
    updateUser: (data: { name?: string; username?: string; image?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: Readonly<AuthProviderProps>) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const normalizeUser = useCallback((nextUser: User | null | undefined): User | null => {
        if (!nextUser) {
            return null;
        }
        return {
            ...nextUser,
            isAdmin: nextUser.role === 'admin',
        };
    }, []);

    const refreshSession = useCallback(async () => {
        try {
            const { data, error } = await authClient.getSession();
            if (data && !error) {
                setSession(data.session);
                setUser(normalizeUser(data.user));
            } else {
                setSession(null);
                setUser(null);
            }
        } catch (error) {
            console.error('Failed to refresh session:', error);
            setSession(null);
            setUser(null);
        }
    }, [normalizeUser]);

    useEffect(() => {
        const initAuth = async () => {
            setIsLoading(true);
            await refreshSession();
            setIsLoading(false);
        };

        initAuth();

        const unsubscribe = authClient.useSession.subscribe((sessionData) => {
            if (sessionData?.data?.session && sessionData?.data?.user) {
                setSession(sessionData.data.session);
                setUser(normalizeUser(sessionData.data.user));
            } else {
                setSession(null);
                setUser(null);
            }
        });

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [refreshSession, normalizeUser]);

    const loginWithMagicLink = useCallback(async (email: string) => {
        const { error } = await authClient.signIn.magicLink({
            callbackURL: '/dashboard', email, errorCallbackURL: '/error', newUserCallbackURL: '/welcome',
        });

        if (error) {
            throw error;
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await authClient.signOut();
            setSession(null);
            setUser(null);
        } catch (error) {
            console.error('Logout failed:', error);
            throw error;
        }
    }, []);

    const updateUser = useCallback(
        async (data: { name?: string; username?: string; image?: string }) => {
            try {
                const { data: updateData, error } = await authClient.updateUser(data);

                if (error) {
                    console.error('Update user failed:', error);
                    throw error;
                }

                if (updateData) {
                    // Refresh session to get updated user data which will trigger state update
                    await refreshSession();
                }
            } catch (error) {
                console.error('Update user failed:', error);
                throw error;
            }
        },
        [refreshSession],
    );

    const value: AuthContextType = useMemo(
        () => ({
            isAuthenticated: !!session && !!user, isLoading, loginWithMagicLink, logout, refreshSession, session, updateUser, user,
        }),
        [user, session, isLoading, loginWithMagicLink, logout, refreshSession, updateUser],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
