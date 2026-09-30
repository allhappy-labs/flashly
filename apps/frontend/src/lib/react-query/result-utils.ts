import { useMutation } from '@tanstack/react-query';
import type { Result } from 'neverthrow';

function getErrorMessage(value: unknown): string | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    if (!('message' in value)) {
        return null;
    }
    const message = value.message;
    return typeof message === 'string' && message.trim().length > 0 ? message : null;
}

export function toError(value: unknown, fallbackMessage: string = 'Request failed'): Error {
    if (value instanceof Error) {
        return value;
    }

    const message = getErrorMessage(value);
    return new Error(message ?? fallbackMessage);
}

export function unwrapResultOrThrow<T, E>(result: Result<T, E>, fallbackMessage?: string): T {
    return result.match(
        (data) => data,
        (error) => {
            throw toError(error, fallbackMessage);
        },
    );
}

type ResultMutationOptions<TData> = {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
};

export function useResultMutation<TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<Result<TData, unknown>>,
    options?: ResultMutationOptions<TData>,
) {
    const mutation = useMutation({
        mutationFn: async (variables: TVariables) => unwrapResultOrThrow(await mutationFn(variables)),
        onSuccess: options?.onSuccess,
        onError: (error) => {
            options?.onError?.(toError(error));
        },
    });

    return {
        ...mutation,
        error: mutation.error ? toError(mutation.error) : null,
        isLoading: mutation.isPending,
        mutate: mutation.mutateAsync,
    };
}
