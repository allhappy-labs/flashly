# Flashly

A modern, full-stack application built with TypeScript, featuring a React frontend, Fastify API, and Astro marketing website.

## 🏗️ Project Structure

This is a monorepo managed with [Turbo](https://turbo.build) and [pnpm](https://pnpm.io).

```
apps/
├── api/               # Fastify API server
├── frontend/          # React 19 + TanStack Router SPA
└── promo/             # Astro marketing website

packages/
├── email-templates/   # React Email templates
└── flashcards/        # Shared flashcard prompt + OpenRouter client
```

## 🛠️ Tech Stack

### API (apps/api)

- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify with plugins
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth
- **File Storage**: S3-compatible storage
- **Email**: SendGrid
- **Billing**: Autumn.js

### Frontend (apps/frontend)

- **Framework**: React 19 with new hooks (useActionState, useOptimistic)
- **Routing**: TanStack Router
- **Styling**: Tailwind CSS + shadcn/ui
- **Internationalization**: Lingui
- **File Uploads**: Better Upload
- **Build Tool**: Vite

### Promo Site (apps/promo)

- **Framework**: Astro with TypeScript
- **Styling**: Tailwind CSS v4
- **Internationalization**: Built-in Astro i18n (English/German)
- **Content**: Markdown with frontmatter
- **Animations**: GSAP + Embla Carousel

## 🚀 Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker, Docker Compose, and PostgreSQL are required only for hosted API and
  web development.

### Installation

1. **Clone the repository**

    ```bash
    git clone https://github.com/allhappy-labs/flashly.git
    cd flashly
    ```

2. **Install dependencies**

    ```bash
    pnpm install
    ```

3. **Start the local-first Expo app**

    The default mobile experience does not require Flashly services:

    ```bash
    pnpm --filter @flashly/mobile start
    ```

    See the [mobile app README](apps/mobile/README.md) for local and hosted
    mode commands.

4. **Start the local web generator**

    The local web generator does not require the API service:

    ```bash
    # Local generator; API service is not required
    pnpm --filter @flashly/frontend dev
    ```

    Local mode talks directly to OpenRouter, ElevenLabs, and Unsplash. Provider
    keys are stored unencrypted in that browser's `localStorage`. Account, quota,
    spend, pricing, billing, subscription, hosted deck, and marketplace features
    are absent.

5. **Start the hosted development path (API and web)**

    Hosted development uses the API, frontend, and supporting services.

    The existing hosted frontend can be started directly with:

    ```bash
    # Existing hosted frontend
    VITE_APP_MODE=hosted pnpm --filter @flashly/frontend dev
    ```

    **Start development services**

    ```bash
    # Start PostgreSQL and Redis with Docker
    pnpm dev:services
    ```

    **Set up environment variables**

    Copy and configure environment files:

    ```bash
    # API configuration
    cp apps/api/.env.example apps/api/.env

    # Frontend configuration
    cp apps/frontend/.env.example apps/frontend/.env

    # Promo site configuration
    cp apps/promo/.env.example apps/promo/.env
    ```

    See individual app README files for detailed environment setup.

    **Initialize and sync the database schema**

    ```bash
    # Run from the repository root
    pnpm --filter @flashly/api db:init
    ```

    **Start development servers**

    ```bash
    # From the repository root, start the hosted API and web development apps
    pnpm dev
    ```

    This will start:
    - API server: http://localhost:3001
    - Frontend app: http://localhost:3000
    - Promo site: http://localhost:4321

## 📝 Development Scripts

### Root Level Commands

```bash
# Development
pnpm dev              # Start all apps (excludes email templates)
pnpm dev:services     # Start Docker services (PostgreSQL, Redis)
pnpm dev:apps         # Start all apps including email templates
pnpm dev:stop         # Stop Docker services

# Building
pnpm build            # Build all packages and apps
pnpm check-types      # Run TypeScript checks across all projects

# Code Quality
pnpm lint             # Lint all files with oxlint
pnpm format           # Format code with Prettier

# Production
pnpm start            # Start production Docker compose
pnpm docker:up        # Start production services
pnpm docker:down      # Stop production services
pnpm docker:logs      # View production logs
pnpm docker:clean     # Clean up Docker volumes

```

### App-Specific Commands

Navigate to individual app directories for app-specific commands:

```bash
# API (apps/api)
cd apps/api
pnpm dev              # Start API development server
pnpm build            # Build API for production
pnpm test             # Run API tests

# Frontend (apps/frontend)
cd apps/frontend
pnpm dev              # Start frontend development server
pnpm build            # Build frontend for production
pnpm test             # Run frontend tests
pnpm lingui:extract   # Extract translatable strings
pnpm lingui:compile   # Compile translations

# Promo Site (apps/promo)
cd apps/promo
pnpm dev              # Start promo site development server
pnpm build            # Build promo site for production
pnpm preview          # Preview production build
```

## 🗄️ Database

The project uses PostgreSQL with Drizzle ORM for type-safe database operations.

### Schema Management

```bash
# From the repository root, initialize or sync the database schema
pnpm --filter @flashly/api db:init

# View database in Drizzle Studio
pnpm --filter @flashly/api exec drizzle-kit studio
```

The `db:init` script runs `drizzle-kit push` as part of the current development
workflow. Add migrations when production data or multiple managed environments require
schema history.

### Development Database

The development setup uses Docker Compose to run PostgreSQL and Redis:

```bash
# Start services
pnpm dev:services

# View logs
pnpm docker:logs

# Reset database (⚠️ destroys data)
pnpm docker:clean && pnpm dev:services
```

## 🔐 Authentication

Authentication is handled by [Better Auth](https://better-auth.com) using **passwordless magic links**:

- Magic link authentication (no passwords required)
- Automatic account creation on first login
- Session management
- User management
- Rate limiting

## 📧 Email System

Email templates are built with [React Email](https://react.email):

- Magic link authentication emails
- Contact form notifications
- System notifications via SendGrid

## 💳 Billing Integration

Billing is powered by [Autumn.js](https://useautumn.com):

- Subscription management
- Usage-based billing
- Payment processing
- Customer portal

## 🌍 Internationalization

### Frontend (Lingui)

```bash
# Extract new translatable strings
pnpm lingui:extract

# Compile translations for production
pnpm lingui:compile
```

### Website (Astro)

- Supports multiple locales (English, German)
- Content-driven translations
- Localized URLs and routing

## 📦 Deployment

### Production Build

```bash
# Build all applications
pnpm build

# Start production services
pnpm start
```

### Environment Variables

Each application requires specific environment variables. See:

- `apps/api/.env.example` - API configuration
- `apps/frontend/.env.example` - Frontend configuration
- `apps/promo/.env.example` - Promo site configuration

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests for specific app
cd apps/frontend && pnpm test
cd apps/api && pnpm test
```

## 📚 Documentation

- [API Documentation](./apps/api/README.md)
- [Frontend Documentation](./apps/frontend/README.md)
- [Promo Site Documentation](./apps/promo/README.md)
- [Email Templates Documentation](./packages/email-templates/README.md)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Add tests if applicable
4. Run `pnpm lint` and `pnpm check-types`
5. Submit a pull request

## 📄 License

[MIT](LICENSE). The marketing theme retains its original [Zeon Studio MIT notice](apps/promo/LICENSE).
