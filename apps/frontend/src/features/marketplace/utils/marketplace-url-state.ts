import type { MarketplaceSortValue } from '@/features/marketplace/types/marketplace.types';
import type { RomanizationPreference } from '@flashly/shared/src';

export type MarketplaceUrlState = {
    search: string;
    materialType?: string;
    deckType?: string;
    locale?: string;
    level?: string;
    skill?: string;
    regionalVariant?: string;
    hasAudio?: boolean;
    script?: string;
    romanization?: RomanizationPreference;
    sortBy: MarketplaceSortValue;
    page: number;
};

export const DEFAULT_MARKETPLACE_SORT: MarketplaceSortValue = 'newest';

export function isMarketplaceSortValue(value: string | null): value is MarketplaceSortValue {
    return value === 'newest' || value === 'most_downloaded' || value === 'most_viewed';
}

function getStringSearchParam(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getPageSearchParam(value: unknown): number {
    const parsedPage = typeof value === 'number'
        ? value
        : Number.parseInt(typeof value === 'string' ? value : '1', 10);
    return Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
}

function getBooleanSearchParam(value: unknown): boolean | undefined {
    if (value === true || value === 'true') {
        return true;
    }
    if (value === false || value === 'false') {
        return false;
    }
    return undefined;
}

function getRomanizationSearchParam(value: unknown): RomanizationPreference | undefined {
    if (
        value === 'native_only'
        || value === 'with_romanization'
        || value === 'romanized_only'
    ) {
        return value;
    }
    return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function getMarketplaceStateFromSearch(search: unknown): MarketplaceUrlState {
    if (!isRecord(search)) {
        return {
            search: '',
            materialType: undefined,
            deckType: undefined,
            locale: undefined,
            level: undefined,
            skill: undefined,
            regionalVariant: undefined,
            hasAudio: undefined,
            script: undefined,
            romanization: undefined,
            sortBy: DEFAULT_MARKETPLACE_SORT,
            page: 1,
        };
    }

    const searchRecord = search;
    const sortParam = getStringSearchParam(searchRecord.sort) ?? null;

    return {
        search: getStringSearchParam(searchRecord.q) ?? '',
        materialType: getStringSearchParam(searchRecord.materialType),
        deckType: getStringSearchParam(searchRecord.deckType),
        locale: getStringSearchParam(searchRecord.locale),
        level: getStringSearchParam(searchRecord.level),
        skill: getStringSearchParam(searchRecord.skill),
        regionalVariant: getStringSearchParam(searchRecord.regionalVariant),
        hasAudio: getBooleanSearchParam(searchRecord.hasAudio),
        script: getStringSearchParam(searchRecord.script),
        romanization: getRomanizationSearchParam(searchRecord.romanization),
        sortBy: isMarketplaceSortValue(sortParam) ? sortParam : DEFAULT_MARKETPLACE_SORT,
        page: getPageSearchParam(searchRecord.page),
    };
}
