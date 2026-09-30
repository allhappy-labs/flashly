type LoggerOptions = Readonly<{
    debugEnabled?: boolean;
}>;

function withPrefix(namespace: string, args: unknown[]): unknown[] {
    return [`[${namespace}]`, ...args];
}

export function createLogger(namespace: string, options?: LoggerOptions) {
    const debugEnabled = options?.debugEnabled ?? import.meta.env.DEV;

    return {
        debug: (...args: unknown[]) => {
            if (!debugEnabled) {
                return;
            }
            console.log(...withPrefix(namespace, args));
        },
        warn: (...args: unknown[]) => {
            if (!debugEnabled) {
                return;
            }
            console.warn(...withPrefix(namespace, args));
        },
        error: (...args: unknown[]) => {
            if (!debugEnabled) {
                return;
            }
            console.error(...withPrefix(namespace, args));
        },
    };
}
