import { z, type ZodIssue } from 'zod';
import {
    DEFAULT_OPENROUTER_MODEL,
    ELEVENLABS_DEFAULT_MODEL_ID,
    ELEVENLABS_DEFAULT_VOICE_NAME,
    FLASHCARD_FORMATS,
    FLASHCARD_MATERIAL_TYPES,
    FLASHCARD_PROMPT_TEMPLATE,
    safeValidate,
    errorFactory,
} from '@flashly/shared';
import dotenv from 'dotenv';

dotenv.config({ override: process.env.NODE_ENV !== 'test' });

const DEFAULT_FLASHCARD_PROMPT_TEMPLATE = FLASHCARD_PROMPT_TEMPLATE;

const configSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .default(() => 3001),

    // Database
    DATABASE_URL: z.url(),

    // Redis (optional)
    REDIS_URL: z.preprocess(
        (value) => (process.env.NODE_ENV === 'test' ? undefined : value),
        z.url().optional(),
    ),

    // CORS - supports single URL or comma-separated list
    CLIENT_ORIGIN: z
        .string()
        .default('http://localhost:3000,http://localhost:4321')
        .transform((val) => {
            // Split by comma and validate each URL
            const origins = val.split(',').map((url) => url.trim());
            return origins.map((origin) => {
                const parsed = z.url().safeParse(origin);
                if (!parsed.success) {
                    throw new Error(`Invalid CLIENT_ORIGIN URL: ${origin}`);
                }
                return parsed.data;
            });
        }),

    // Authentication
    AUTH_SECRET: z.string().min(1, 'AUTH_SECRET is required'),
    AUTH_URL: z.url().default('http://localhost:3001'),
    E2E_AUTH_SECRET: z.string().default(''),
    E2E_TEST_USER_EMAIL: z.email().default('e2e@flashly.test'),
    E2E_TEST_USER_PASSWORD: z.string().default(''),
    E2E_TEST_USER_NAME: z.string().min(1).default('Flashly E2E User'),

    // Sentry (optional)
    SENTRY_DSN: z.url().optional(),

    // Rate limiting
    RATE_LIMIT_MAX: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .default(() => 100),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    TRUST_PROXY: z
        .string()
        .default('false')
        .transform((value) => {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true') {
                return true;
            }
            if (normalized === 'false') {
                return false;
            }

            if (/^\d+$/.test(normalized)) {
                return Number(normalized);
            }

            // Pass through string values supported by Fastify (e.g. IP/CIDR lists)
            return value.trim();
        }),

    // File uploads
    UPLOAD_SIZE_LIMIT: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .default(() => 10485760), // 10MB
    UPLOAD_AUTH_REQUIRED: z
        .string()
        .transform((val) => val === 'true')
        .default(() => true), // Secure by default

    // OpenRouter (LLM)
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
    OPENROUTER_MODEL: z.string().default(DEFAULT_OPENROUTER_MODEL),
    OPENROUTER_TIMEOUT_MS: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .default(() => 20000),
    OPENROUTER_APP_NAME: z.string().optional(),
    OPENROUTER_SITE_URL: z.url().optional(),

    // ElevenLabs (TTS)
    ELEVENLABS_API_KEY: z.string().optional(),
    ELEVENLABS_BASE_URL: z.string().default('https://api.elevenlabs.io/v1'),
    ELEVENLABS_MODEL_ID: z.string().default(ELEVENLABS_DEFAULT_MODEL_ID),
    ELEVENLABS_OUTPUT_FORMAT: z.string().default('mp3_44100_128'),
    ELEVENLABS_VOICE_NAME: z.string().default(ELEVENLABS_DEFAULT_VOICE_NAME),
    ELEVENLABS_VOICE_ID: z.string().optional(),

    // Unsplash (images)
    UNSPLASH_ACCESS_KEY: z.string().optional(),

    // Flashcard generation
    FLASHCARD_FORMATS: z
        .string()
        .default(FLASHCARD_FORMATS.join(','))
        .transform((value) =>
            value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean),
        ),
    FLASHCARD_MATERIAL_TYPES: z
        .string()
        .default(FLASHCARD_MATERIAL_TYPES.join(','))
        .transform((value) =>
            value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean),
        ),
    FLASHCARD_DEFAULT_FORMAT: z.string().default(FLASHCARD_FORMATS[0]),
    FLASHCARD_DEFAULT_MATERIAL_TYPE: z.string().default(FLASHCARD_MATERIAL_TYPES[0]),
    FLASHCARD_PROMPT_TEMPLATE: z.string().default(DEFAULT_FLASHCARD_PROMPT_TEMPLATE),
    FLASHCARD_MAX_SOURCE_CHARS: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .default(() => 50000),
    FLASHCARD_RATE_LIMIT_MAX: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .default(() => 6),
    FLASHCARD_UPLOAD_RETENTION_HOURS: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .default(() => 24),
    FLASHCARD_UPLOAD_PREFIX: z.string().default('flashcards'),
    AUDIO_CACHE_PREFIX: z.string().default('audio-cache'),
    TTS_MAX_TEXT_LENGTH: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .default(() => 1000),
    TTS_RATE_LIMIT_MAX: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .default(() => 30),
    UPLOAD_DOWNLOAD_RATE_LIMIT_MAX: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .default(() => 240),

    // Email (Plunk)
    MAIL_API_KEY: z.string().min(1, 'MAIL_API_KEY is required for email sending'),
    MAIL_FROM_EMAIL: z.email('MAIL_FROM_EMAIL must be a valid email'),
    MAIL_FROM_NAME: z.string().optional(),
    MAIL_LOGO_URL: z.preprocess(
        (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
        z
            .url()
            .refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
                message: 'MAIL_LOGO_URL must be an absolute HTTP(S) URL',
            })
            .optional(),
    ),
    PLUNK_BASE_URL: z.preprocess(
        (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
        z.url().optional(),
    ),
    PLUNK_VALIDATE_SSL: z.preprocess(
        (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
        z
            .string()
            .transform((val) => val === 'true')
            .optional(),
    ),

    // Autumn (Billing)
    AUTUMN_SECRET_KEY: z.string().min(1, 'AUTUMN_SECRET_KEY is required for billing integration'),

    // S3 Storage
    S3_REGION: z.string().default('us-east-1'),
    S3_ACCESS_KEY_ID: z.string().min(1, 'S3_ACCESS_KEY_ID is required for S3 storage'),
    S3_SECRET_ACCESS_KEY: z.string().min(1, 'S3_SECRET_ACCESS_KEY is required for S3 storage'),
    S3_ENDPOINT: z.url().optional(),
    S3_PRIVATE_BUCKET_NAME: z.string().min(1, 'S3_PRIVATE_BUCKET_NAME is required'),
    S3_PUBLIC_BUCKET_NAME: z.string().min(1, 'S3_PUBLIC_BUCKET_NAME is required'),
    S3_PUBLIC_URL: z.url('S3_PUBLIC_URL must be a valid URL'),
}).superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'test') {
        return;
    }

    const secret = data.E2E_AUTH_SECRET.trim();
    if (secret.length < 32) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'E2E_AUTH_SECRET must be at least 32 characters in test environment',
            path: ['E2E_AUTH_SECRET'],
        });
    }

    const hasLetter = /[a-zA-Z]/.test(secret);
    const hasDigit = /\d/.test(secret);
    if (!hasLetter || !hasDigit) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'E2E_AUTH_SECRET must include both letters and digits in test environment',
            path: ['E2E_AUTH_SECRET'],
        });
    }

    const password = data.E2E_TEST_USER_PASSWORD;
    if (password.length < 16) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'E2E_TEST_USER_PASSWORD must be at least 16 characters in test environment',
            path: ['E2E_TEST_USER_PASSWORD'],
        });
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    if (!(hasUpper && hasLower && hasNumber && hasSymbol)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
                'E2E_TEST_USER_PASSWORD must include uppercase, lowercase, number, and symbol in test environment',
            path: ['E2E_TEST_USER_PASSWORD'],
        });
    }
});

function validateConfigSafe() {
    return safeValidate(configSchema, process.env).mapErr((error) => {
        // Handle ZodError
        if (error instanceof Error && 'issues' in error) {
            const zodError = error as { issues: ZodIssue[] };
            const errorMessages = zodError.issues
                .map((err: ZodIssue) => `${err.path.join('.')}: ${err.message}`)
                .join('\n');

            console.error('❌ Configuration validation failed:');
            console.error(errorMessages);
            console.error('\nPlease check your environment variables and try again.');

            return errorFactory.configuration('Invalid configuration', {
                context: { errors: errorMessages },
            });
        }

        // Handle other errors
        console.error('❌ Configuration validation failed:', error.message);
        return errorFactory.configuration('Invalid configuration', { cause: error });
    });
}

// For backward compatibility, we still export the validated config directly
// but use the safe validation internally
const validationResult = validateConfigSafe();

if (validationResult.isErr()) {
    // Exit with error if configuration is invalid
    console.error('❌ Failed to start: Configuration validation failed');
    process.exit(1);
}

export const config = validationResult.value;

export type Config = typeof config;
