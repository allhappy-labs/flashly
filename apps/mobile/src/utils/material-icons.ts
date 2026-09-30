import type Ionicons from '@expo/vector-icons/Ionicons';
import type { FlashcardMaterialTypeIconKey } from '@flashly/shared';
import type { ComponentProps } from 'react';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const MATERIAL_ICON_KEY_TO_IONICON: Record<FlashcardMaterialTypeIconKey, IoniconName> = {
  'book-open': 'book-outline',
  languages: 'globe-outline',
  stethoscope: 'medkit-outline',
  'code-2': 'code-slash-outline',
  calculator: 'calculator-outline',
  atom: 'nuclear-outline',
  beaker: 'flask-outline',
  microscope: 'leaf-outline',
  landmark: 'school-outline',
  globe: 'earth-outline',
  brain: 'body-outline',
  'trending-up': 'trending-up-outline',
  scale: 'library-outline',
  briefcase: 'business-outline',
  music: 'musical-notes-outline',
  palette: 'brush-outline',
  cog: 'construct-outline',
  database: 'server-outline',
  'scroll-text': 'document-text-outline',
  library: 'library-outline',
  users: 'people-outline',
  'building-2': 'business-outline',
};
