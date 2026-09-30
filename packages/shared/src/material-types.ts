export const FLASHCARD_MATERIAL_TYPES = [
    'General', 'Language', 'Medical', 'Computer Science',
    'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'History', 'Geography', 'Psychology', 'Economics',
    'Law', 'Business', 'Music', 'Art',
    'Engineering', 'Data Science', 'Philosophy',
    'Literature', 'Sociology', 'Political Science',
] as const;

export type FlashcardMaterialType = (typeof FLASHCARD_MATERIAL_TYPES)[number];

export type FlashcardMaterialTypeIconKey =
    | 'book-open'
    | 'languages'
    | 'stethoscope'
    | 'code-2'
    | 'calculator'
    | 'atom'
    | 'beaker'
    | 'microscope'
    | 'landmark'
    | 'globe'
    | 'brain'
    | 'trending-up'
    | 'scale'
    | 'briefcase'
    | 'music'
    | 'palette'
    | 'cog'
    | 'database'
    | 'scroll-text'
    | 'library'
    | 'users'
    | 'building-2';

export type FlashcardMaterialTypeMeta = {
    translationKey: string;
    iconKey: FlashcardMaterialTypeIconKey;
};

export type FlashcardMaterialAccentKey =
    | 'general'
    | 'language'
    | 'science'
    | 'coding'
    | 'math'
    | 'physics'
    | 'chemistry'
    | 'biology'
    | 'history'
    | 'geography'
    | 'psychology'
    | 'economics'
    | 'law'
    | 'business'
    | 'music'
    | 'art'
    | 'engineering'
    | 'dataScience'
    | 'philosophy'
    | 'literature'
    | 'sociology'
    | 'politicalScience';

export const FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS: Record<FlashcardMaterialType, string> = {
    'General': 'general',
    'Language': 'language',
    'Medical': 'medical',
    'Computer Science': 'cs',
    'Mathematics': 'math',
    'Physics': 'physics',
    'Chemistry': 'chemistry',
    'Biology': 'biology',
    'History': 'history',
    'Geography': 'geography',
    'Psychology': 'psychology',
    'Economics': 'economics',
    'Law': 'law',
    'Business': 'business',
    'Music': 'music',
    'Art': 'art',
    'Engineering': 'engineering',
    'Data Science': 'dataScience',
    'Philosophy': 'philosophy',
    'Literature': 'literature',
    'Sociology': 'sociology',
    'Political Science': 'politicalScience',
};

export const FLASHCARD_MATERIAL_TYPE_ICON_KEYS: Record<FlashcardMaterialType, FlashcardMaterialTypeIconKey> = {
    'General': 'book-open',
    'Language': 'languages',
    'Medical': 'stethoscope',
    'Computer Science': 'code-2',
    'Mathematics': 'calculator',
    'Physics': 'atom',
    'Chemistry': 'beaker',
    'Biology': 'microscope',
    'History': 'landmark',
    'Geography': 'globe',
    'Psychology': 'brain',
    'Economics': 'trending-up',
    'Law': 'scale',
    'Business': 'briefcase',
    'Music': 'music',
    'Art': 'palette',
    'Engineering': 'cog',
    'Data Science': 'database',
    'Philosophy': 'scroll-text',
    'Literature': 'library',
    'Sociology': 'users',
    'Political Science': 'building-2',
};

// Type-safe material type metadata - built from existing mappings
// Note: Object.fromEntries always returns Record<string, T>, losing the specific key type.
// We use a type assertion here since we're iterating over FLASHCARD_MATERIAL_TYPES
// which guarantees all keys are valid FlashcardMaterialType values.
export const FLASHCARD_MATERIAL_TYPE_META: Record<FlashcardMaterialType, FlashcardMaterialTypeMeta> =
    FLASHCARD_MATERIAL_TYPES.reduce((acc, materialType) => {
        acc[materialType] = {
            translationKey: FLASHCARD_MATERIAL_TYPE_TRANSLATION_KEYS[materialType],
            iconKey: FLASHCARD_MATERIAL_TYPE_ICON_KEYS[materialType],
        };
        return acc;
    }, {} as Record<FlashcardMaterialType, FlashcardMaterialTypeMeta>);

export const FLASHCARD_MATERIAL_TYPE_ACCENT_KEYS: Record<FlashcardMaterialType, FlashcardMaterialAccentKey> = {
    General: 'general',
    Language: 'language',
    Medical: 'science',
    'Computer Science': 'coding',
    Mathematics: 'math',
    Physics: 'physics',
    Chemistry: 'chemistry',
    Biology: 'biology',
    History: 'history',
    Geography: 'geography',
    Psychology: 'psychology',
    Economics: 'economics',
    Law: 'law',
    Business: 'business',
    Music: 'music',
    Art: 'art',
    Engineering: 'engineering',
    'Data Science': 'dataScience',
    Philosophy: 'philosophy',
    Literature: 'literature',
    Sociology: 'sociology',
    'Political Science': 'politicalScience',
};

export const FLASHCARD_MATERIAL_TYPE_GROUPS: Record<string, readonly FlashcardMaterialType[]> = {
    General: ['General'],
    Languages: ['Language'],
    'Natural Sciences': ['Medical', 'Biology', 'Chemistry', 'Physics'],
    'Mathematics & Technology': ['Mathematics', 'Computer Science', 'Engineering', 'Data Science'],
    'Social Sciences': ['Psychology', 'Economics', 'Sociology', 'Political Science'],
    Humanities: ['History', 'Geography', 'Philosophy', 'Literature'],
    'Professional & Arts': ['Law', 'Business', 'Music', 'Art'],
};
