# API Server

Fastify-based API server with TypeScript, authentication, file uploads, and billing integration.

## Current Engineering Work

- API remediation tracker: [API remediation plan](../../docs/api-app-remediation-plan.md)

## 🛠️ Tech Stack

- **Framework**: Fastify with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth
- **File Storage**: S3-compatible storage
- **Email**: Plunk
- **Billing**: Autumn.js
- **Caching**: Redis
- **Error Tracking**: Sentry (optional)

## 🚀 Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL database
- Redis (optional, for caching)
- S3-compatible storage bucket
- Plunk account for emails

### Environment Setup

1. Copy the environment file:

    ```bash
    cp .env.example .env
    ```

2. Configure the required environment variables (see Environment Variables section below)

3. Initialize database and sync schema (development workflow):
    ```bash
    pnpm init
    # or, after schema changes:
    pnpm db:init
    ```

### Available Scripts

```bash
# Development
pnpm dev              # Start development server with hot reload
pnpm start            # Start production server

# Testing
pnpm test             # Run test suite with coverage

# Code Quality
pnpm lint             # Lint code with oxlint
pnpm check:types      # Run TypeScript type checking (+ @ts-nocheck guard)

# S3 Setup
pnpm setup:s3         # Configure S3 CORS settings
pnpm verify:s3        # Verify S3 configuration
```

## 🗄️ Database

The API uses PostgreSQL with Drizzle ORM for type-safe database operations.

### Schema Management (Current Development Workflow)

```bash
# Push schema directly (no migration files in current dev setup)
pnpm exec drizzle-kit push

# View database in Drizzle Studio
pnpm dlx drizzle-kit studio
```

The API currently uses `drizzle-kit push` for development iteration instead of generated migrations.

## 🔐 Authentication

Authentication is handled by Better Auth with a mixed setup:

- Magic link authentication (passwordless)
- Bearer token support
- Expo/mobile auth integration
- One-time token support in `NODE_ENV=test` for E2E flows
- Session management
- Rate limiting
- CSRF protection
- Billing integration hooks (Autumn)

### Endpoints (subset)

- `GET|POST /api/auth/*` - Better Auth routes (mounted pass-through)
- `POST /api/test-auth/one-time-token` - Test-only E2E auth helper (`NODE_ENV=test`)

## 📧 Email System

The API integrates with Plunk for transactional emails:

- Magic link authentication emails
- Contact form notifications
- System notifications

## 📤 File Upload System

The API provides secure file upload endpoints with S3 storage:

### Upload Endpoints

- `POST /api/upload` - Better Upload handler entry point
- `GET /api/upload/health` - Upload handler health check

### Features

- File type validation
- Size limits
- Optional auth gate (`UPLOAD_AUTH_REQUIRED`)
- S3-backed storage flows

## 💳 Billing Integration

Billing is powered by Autumn.js & Stripe:

- Subscription management
- Usage-based billing
- Payment processing
- Customer portal
- Webhook handling

## ⚙️ Environment Variables

Required environment variables:

### Core Configuration

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### Authentication

```env
AUTH_SECRET=your-super-secure-secret-key-here-at-least-32-chars
AUTH_URL=http://localhost:3001
```

### Email (Plunk)

```env
MAIL_API_KEY=your-plunk-api-key
MAIL_FROM_EMAIL=noreply@yourdomain.com
MAIL_FROM_NAME=Your App Name
MAIL_LOGO_URL=https://yourdomain.com/brand/email-logo.png
PLUNK_BASE_URL=
PLUNK_VALIDATE_SSL=true
```

`MAIL_LOGO_URL` must be an absolute `http://` or `https://` URL (not a `data:` URI).

### S3 Storage

```env
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_PRIVATE_BUCKET_NAME=your-private-bucket
S3_PUBLIC_BUCKET_NAME=your-public-bucket
S3_PUBLIC_URL=https://your-bucket.s3.amazonaws.com
```

### OpenRouter (Flashcards)

```env
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=x-ai/grok-4.1-fast
OPENROUTER_TIMEOUT_MS=20000
OPENROUTER_SITE_URL=https://your-app.example
OPENROUTER_APP_NAME=Flashly API
```

### Billing (Autumn.js)

```env
AUTUMN_SECRET_KEY=your-autumn-secret-key
```

### Optional

```env
REDIS_URL=redis://localhost:6379
SENTRY_DSN=https://your-sentry-dsn
RATE_LIMIT_MAX=100
```

### Flashcards

```env
FLASHCARD_FORMATS=QA,Cloze,Definition
FLASHCARD_MATERIAL_TYPES=General,Language,Medical,Computer Science
FLASHCARD_DEFAULT_FORMAT=QA
FLASHCARD_DEFAULT_MATERIAL_TYPE=General
FLASHCARD_PROMPT_TEMPLATE=... # JSONL-only prompt template
FLASHCARD_UPLOAD_RETENTION_HOURS=24
FLASHCARD_UPLOAD_PREFIX=flashcards
```

## 🌐 API Routes

### Health Check

- `GET /` - API health status

### Authentication

- `POST /api/auth/*` - Better Auth routes

### File Uploads

- `POST /api/upload/*` - File upload endpoints

### Flashcards

- `POST /api/flashcards` - Generate flashcards from a single uploaded file (multipart/form-data).
    - File types: `.txt`, `.md`, `.pdf`
    - Fields: `format`, `materialType`, `instruction` (optional)
    - Response: `{ "flashcards": [{ "front": "...", "back": "..." }] }`

#### Portable Flashcard Generation (Client-side)

Flashcard generation logic is shared in `packages/flashcards`, so the frontend can call OpenRouter directly when a user supplies their own API token. Example usage in the browser:

```ts
import { buildFlashcardPrompt, generateFlashcardsWithOpenRouter } from '@flashly/shared/src';

const { prompt } = buildFlashcardPrompt(
    {
        documentText,
        format: 'QA',
        materialType: 'General',
        customInstruction: userInstruction,
    },
    {
        template: FLASHCARD_PROMPT_TEMPLATE,
        formats: ['QA', 'Cloze', 'Definition'],
        materialTypes: ['General', 'Language'],
        defaultFormat: 'QA',
        defaultMaterialType: 'General',
    },
);

const result = await generateFlashcardsWithOpenRouter({
    apiKey: userToken,
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'x-ai/grok-4.1-fast',
    prompt,
});
```

Note: Client-side calls require OpenRouter CORS support and expose the user token in the browser.

### Billing

- `POST /api/billing/webhook` - Autumn webhook handler
- `GET /api/billing/portal` - Customer portal access

## 🔧 Configuration

### CORS

The API supports multiple client origins via the `CLIENT_ORIGIN` environment variable:

```env
CLIENT_ORIGIN=http://localhost:3000,http://localhost:4321
```

### Rate Limiting

Configurable rate limiting per endpoint:

```env
RATE_LIMIT_MAX=100  # requests per minute
```

### Upload Limits

```env
UPLOAD_SIZE_LIMIT=10485760  # 10MB default
UPLOAD_AUTH_REQUIRED=true   # require authentication
```

### Flashcard Upload Retention

Flashcard uploads are stored in the private S3 bucket using a SHA-256 checksum as the object key. To keep storage costs low, configure a lifecycle rule on the private bucket to delete the `flashcards/` prefix after 1 day. The API will deduplicate uploads by checksum and reuse existing objects when available.

## S3 Object Storage Setup

This project uses S3 Object Storage for file uploads, including avatar uploads. To enable browser-based uploads, you need to configure CORS properly.

### Prerequisites

1. S3 Object Storage bucket (e.g., `user-assets`)
2. S3 API keys with the following permissions:
    - `ObjectStorageObjectsRead`
    - `ObjectStorageObjectsWrite`
    - `ObjectStorageBucketsRead`
    - `ObjectStorageBucketsWrite` (required for CORS configuration)

### Environment Configuration

Ensure your `.env` file contains:

```env
# S3 Upload Configuration
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_REGION=fr-par
S3_PRIVATE_BUCKET_NAME=your-private-bucket-name
S3_PUBLIC_BUCKET_NAME=your-public-bucket-name
S3_PUBLIC_URL=https://your-public-bucket-name.s3.fr-par.scw.cloud
S3_ENDPOINT=https://s3.fr-par.scw.cloud
```

### CORS Setup

#### Automated Setup (Recommended)

Use the provided scripts to manage CORS configuration:

```bash
# Apply CORS configuration for development
node --env-file=.env scripts/setup-s3-cors.ts
```

### Troubleshooting

#### CORS Error: "No 'Access-Control-Allow-Origin' header"

This error occurs when:

- CORS is not configured on the bucket
- Frontend origin is not in the allowed origins list
- S3 credentials lack bucket management permissions

**Solutions:**

1. Ensure S3 credentials have bucket management permissions
2. Configure CORS manually in your S3 provider's console if automated setup fails

#### Access Denied Error

If you get "AccessDenied" when running setup scripts:

- Verify S3 credentials have the correct permissions
- Check bucket ownership in your S3 provider's console
- Use manual CORS configuration as fallback
