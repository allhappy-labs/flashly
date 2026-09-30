export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-5.2';

// Flashcard generation estimation constants
export const GENERATION_ESTIMATE = {
    BASE_TOKENS_PER_SECOND: 24,
    AVERAGE_CHARS_PER_TOKEN: 4,
    MIN_ESTIMATE_SECONDS: 60,
    MAX_ESTIMATE_SECONDS: 180, // Increased from 90
    CARD_COUNT_WEIGHT: 0.01,
    BASE_CARD_COUNT: 10,

    // Batch refinement weights
    BATCH_WEIGHTS: {
        FIRST: 1.0,
        SECOND: 0.7,
        THIRD: 0.5,
        STABLE: 0.3,
    },
} as const;

// Material type complexity multipliers
export const MATERIAL_TYPE_COMPLEXITY: Record<string, number> = {
    // High complexity
    'Language': 1.5,
    'Medical': 1.5,
    'Computer Science': 1.5,
    'Mathematics': 1.5,
    'Physics': 1.5,
    'Chemistry': 1.5,
    'Engineering': 1.5,

    // Medium complexity
    'Data Science': 1.2,
    'Psychology': 1.2,
    'Economics': 1.2,
    'Law': 1.2,
    'Philosophy': 1.2,
    'Biology': 1.2,

    // Base complexity (1.0 - default)
    'General': 1.0,
    'History': 1.0,
    'Geography': 1.0,
    'Literature': 1.0,
    'Sociology': 1.0,
    'Political Science': 1.0,
    'Business': 1.0,
    'Music': 1.0,
    'Art': 1.0,
} as const;
