import { startTransition, useCallback, useMemo, useOptimistic, useState } from 'react';
import { funnel } from 'remeda';
import { useTranslation } from 'react-i18next';
import { getApiClient } from '@/lib/api/client';

interface UsernameCheckResponse {
    available: boolean;
    message: string;
}

interface UsernameCheckResult {
    isChecking: boolean;
    isAvailable: boolean | null;
    message: string | null;
    optimisticAvailable: boolean | null;
    checkUsername: (username: string, currentUsername?: string) => void;
    resetState: () => void;
}

export function useUsernameCheck(): UsernameCheckResult {
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const { t } = useTranslation();

    // Optimistic availability for immediate UI feedback
    const [optimisticAvailable, setOptimisticAvailable] = useOptimistic(
        isAvailable,
        (_current, newValue: boolean | null) => newValue,
    );

    const resetState = useCallback(() => {
        setIsAvailable(null);
        setMessage(null);
        setIsChecking(false);
    }, []);

    const checkUsernameApi = useCallback(async (username: string) => {
        if (!username || username.length < 3) {
            resetState();
            return;
        }

        try {
            setIsChecking(true);
            const api = getApiClient();
            if (!api) {
                throw new Error('API client not initialized');
            }

            const result = await api.get<UsernameCheckResponse>(
                `/api/user/username/check?username=${encodeURIComponent(username)}`,
            );

            const data = result.match(
                (value) => value,
                (error) => {
                    throw new Error(error.message || 'Failed to check username availability');
                },
            );

            setIsAvailable(data.available);
            setMessage(data.available ? t('web.username.available') : t('web.username.taken'));
        } catch (error) {
            console.error('Username check error:', error);
            setIsAvailable(null);
            setMessage(t('web.username.error'));
        } finally {
            setIsChecking(false);
        }
    }, [resetState, t]);

    const debouncedCheckApi = useMemo(
        () =>
            funnel(checkUsernameApi, {
                minQuietPeriodMs: 500,
                reducer: (_prev: unknown, username: string) => username,
            }),
        [checkUsernameApi],
    );

    const checkUsername = useCallback(
        (username: string, currentUsername?: string) => {
            // Reset state immediately
            resetState();

            // If username is the same as current username, mark as available
            if (currentUsername && username === currentUsername) {
                setIsAvailable(true);
                setMessage(t('web.username.current'));
                setIsChecking(false);
                return;
            }

            // Validate username format
            if (!username) {
                setIsChecking(false);
                return;
            }

            const validationErrors = [
                {
                    condition: username.length < 3,
                    message: t('web.username.minLength'),
                },
                {
                    condition: username.length > 30,
                    message: t('web.username.maxLength'),
                },
                {
                    condition: !/^[a-zA-Z0-9_-]+$/.test(username),
                    message: t('web.username.allowedChars'),
                },
            ];

            const error = validationErrors.find((v) => v.condition);
            if (error) {
                setIsAvailable(false);
                setMessage(error.message);
                setIsChecking(false);
                return;
            }

            // Show optimistic "checking" state for immediate feedback
            startTransition(() => {
                setOptimisticAvailable(null);
            });

            // If validation passes, perform debounced API check
            setIsChecking(true);
            debouncedCheckApi.call(username);
        },
        [debouncedCheckApi, setOptimisticAvailable, resetState, t],
    );

    return {
        checkUsername, isAvailable, isChecking, message, optimisticAvailable, resetState,
    };
}
