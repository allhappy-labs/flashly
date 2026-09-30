import {
  FLASHCARD_MATERIAL_TYPE_ACCENT_KEYS,
  type FlashcardMaterialType,
} from '@flashly/shared/src';

export function getAccentKeyForMaterialType(materialType?: string | null): string {
  if (!materialType) return 'general';
  if (materialType in FLASHCARD_MATERIAL_TYPE_ACCENT_KEYS) {
    return FLASHCARD_MATERIAL_TYPE_ACCENT_KEYS[materialType as FlashcardMaterialType];
  }
  return 'general';
}
