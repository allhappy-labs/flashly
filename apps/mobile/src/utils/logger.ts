function getDevFlag(): boolean {
  const value = Reflect.get(globalThis, '__DEV__');
  return value === true;
}

function shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
  if (level === 'warn' || level === 'error') {
    return true;
  }
  return getDevFlag();
}

function write(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: unknown[]) {
  if (!shouldLog(level)) {
    return;
  }

  if (level === 'debug') {
    console.log(message, ...args);
    return;
  }
  if (level === 'info') {
    console.info(message, ...args);
    return;
  }
  if (level === 'warn') {
    console.warn(message, ...args);
    return;
  }
  console.error(message, ...args);
}

export const logger = {
  debug(message: string, ...args: unknown[]) {
    write('debug', message, ...args);
  },
  info(message: string, ...args: unknown[]) {
    write('info', message, ...args);
  },
  warn(message: string, ...args: unknown[]) {
    write('warn', message, ...args);
  },
  error(message: string, ...args: unknown[]) {
    write('error', message, ...args);
  },
};

