import {
    FLASHCARD_MATERIAL_TYPES,
    FLASHCARD_MATERIAL_TYPE_ACCENT_KEYS,
    type FlashcardMaterialType,
} from '@flashly/shared';
import { DECK_ACCENTS, DEFAULT_DECK_ACCENT_KEY, type DeckAccent } from '../../constants';

const FALLBACK_ACCENT: DeckAccent = {
    key: DEFAULT_DECK_ACCENT_KEY,
    labelKey: 'deck.accentGeneral',
    icon: 'book-outline',
    background: 'rgba(59, 130, 246, 0.16)',
    color: '#60a5fa',
};

export function isFlashcardMaterialType(value: string): value is FlashcardMaterialType {
    return FLASHCARD_MATERIAL_TYPES.includes(value as FlashcardMaterialType);
}

export function getDeckAccent(materialType?: string | null): DeckAccent {
    if (materialType && isFlashcardMaterialType(materialType)) {
        const accentKey = FLASHCARD_MATERIAL_TYPE_ACCENT_KEYS[materialType];
        const accent = DECK_ACCENTS.find((item) => item.key === accentKey);
        if (accent) {
            return accent;
        }
    }

    return DECK_ACCENTS.find((item) => item.key === DEFAULT_DECK_ACCENT_KEY)
        ?? DECK_ACCENTS[0]
        ?? FALLBACK_ACCENT;
}
