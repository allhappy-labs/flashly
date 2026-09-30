interface FormatCurrencyOptions {
    currency?: string;
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
}

export function formatCurrency(amount: number, options: FormatCurrencyOptions = {}): string {
    const { currency = 'EUR', locale = 'en-US', minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;

    return new Intl.NumberFormat(locale, {
        currency, maximumFractionDigits, minimumFractionDigits, style: 'currency',
    }).format(amount);
}

export function formatCurrencyCompact(amount: number, options: FormatCurrencyOptions = {}): string {
    const { currency = 'EUR', locale = 'en-US' } = options;

    return new Intl.NumberFormat(locale, {
        currency, maximumFractionDigits: 1, notation: 'compact', style: 'currency',
    }).format(amount);
}

export function parseCurrencyAmount(currencyString: string): number {
    // Remove currency symbols, spaces, and commas, then parse as float
    const cleanString = currencyString.replaceAll(/[^0-9.-]/g, '');
    return Number.parseFloat(cleanString) || 0;
}
