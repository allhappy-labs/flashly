# Repository Guidelines

## Project Structure

Monorepo with apps in `apps/` and shared packages in `packages/`:

### Apps
- `apps/frontend` - Vite + React web app (`@flashly/frontend`)
  - Source in `src/`: UI in `src/components`, screens in `src/screens`, navigation in `src/router`, state in `src/store` (Zustand), utilities in `src/utils`
  - Theme tokens in `src/theme.ts`; shared constants in `src/constants.ts`
- `apps/mobile` - Expo (React Native) mobile app (`@flashly/mobile`)
  - Source in `src/`: UI in `src/components`, screens in `src/screens`, navigation in `src/navigation`, state in `src/store` (Zustand), persistence in `src/db`
  - Entry points: `App.tsx` and `index.ts`. Avoid editing `android/` or `ios/` unless doing native work
- `apps/api` - Fastify backend API (`@flashly/api`)
  - Source in `src/`: routes in `src/routes`, services in `src/services`, utilities in `src/utils`
- `apps/promo` - Astro marketing website (`@flashly/promo`)
  - Multilingual content collections in `src/content`
  - Components in `src/components`, layouts in `src/layouts`

### Packages
- `packages/shared` - Shared utilities, types, and i18n (`@flashly/shared`)
  - i18n lives in `src/i18n`; add locale files there and wire them in the initializer
- `packages/branding` - Shared branding assets and design tokens (`@flashly/branding`)
- `packages/email-templates` - Email templates (`@flashly/email-templates`)

## Development Commands

### Root Level
- `pnpm dev` - Start all apps (frontend, mobile, api, promo) and services via Docker
- `pnpm dev:services` - Start Docker services (PostgreSQL, Redis, etc.)
- `pnpm dev:apps` - Start all apps without services
- `pnpm dev:stop` - Stop Docker services
- `pnpm build` - Build all packages
- `pnpm lint` - Lint all files with oxlint (auto-fixes)
- `pnpm format` - Format with Prettier
- `pnpm check:types` - Type check all packages
- `pnpm validate` - Run monorepo validity checks (lint, build, and type checks across apps/packages)
- `pnpm verify` - Run lint and type checks in parallel
- `pnpm docker:up`/`pnpm docker:down` - Start/stop production Docker containers

### Development Workflow
- Do not use type assertions/casts (`as` or angle-bracket casts). Use proper types, generics, and type guards.
- After completing any change, run `pnpm validate` and `pnpm verify` from the monorepo root before committing.

### Frontend (apps/frontend)
- `pnpm dev` - Start Vite dev server on port 3000
- `pnpm build` - Build for production
- `pnpm test` - Run Vitest tests
- `pnpm storybook:run` - Start Storybook on port 6006

### Mobile (apps/mobile)
- `pnpm start` - Start Expo dev server
- `pnpm ios` - Run on iOS simulator
- `pnpm android` - Run on Android emulator
- `pnpm web` - Run on web

### API (apps/api)
- `pnpm dev` - Start Fastify dev server with hot reload on port 3001
- `pnpm start` - Start production server
- `pnpm test` - Run tests with c8
- `pnpm db:init` - Initialize database schema

#### Database Management

**Current Approach (Development)**: The project does not use database migrations. Instead, schema changes are synced directly to the database using `drizzle-kit push`.

- **Why no migrations?** This is a development app with no production data yet. Using `push` is simpler for rapid iteration.
- **Workflow for schema changes**:
  1. Edit schema in `apps/api/lib/auth/auth-schema.ts`
  2. Run `npx drizzle-kit push` from `apps/api/` to sync changes to database
  3. No migration files or history to manage

**When to add migrations**: If the app needs production deployment, multiple environments, or schema change tracking, start generating migrations with `drizzle-kit generate` from the current schema state.

### Promo (apps/promo)
- `pnpm dev` - Start Astro dev server with theme generator watch mode
- `pnpm build` - Build static site
- `pnpm preview` - Preview production build

## Coding Conventions

- TypeScript `strict`; functional components; prefer hooks/derived selectors over prop drilling.
- Naming: components/screens PascalCase, hooks/utils camelCase, constants SCREAMING_SNAKE_CASE.
- Two-space indentation, minimal comments, and styling via theme tokens.
- Wrap React props in `Readonly`; avoid type casts when a type guard fits.
- Avoid prop destructuring in components; prefer `props.size` style access.
- Keep hook deps explicit (use only referenced values).
- Remove unused variables/params when lint/TS complains.
- Use dynamic imports for heavy components/screens.

## Localization & UX

- Translate all user-visible text via `packages/shared/src/i18n` (no hardcoded strings).
  - **CRITICAL**: Never add hardcoded user-visible text. Always use translation keys from `packages/shared/src/i18n`. Check existing keys before adding new ones.
- Use `sonner` for user feedback in success/failure flows.

## Debugging

- Use Playwright MCP to test the frontend app live.
- If the root cause is unknown, add console logs and reproduce with Playwright MCP to inspect them.
- After fixing, verify again with Playwright MCP; if verified, remove the added console logs.

## Testing

- No formal suite yet. For risky changes (navigation, persistence, i18n), add focused tests alongside sources if you introduce a harness.
- Include manual test notes in PRs (screens, steps, device/OS).

## Git & PRs

- Ask for approval before committing; never push without explicit go-ahead.
- Use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `ui:`) with concise, imperative scopes.
- PRs: summary, linked issues/IDs, screenshots/recordings for UI, manual test notes, and note any `src/db` migrations.
- Do not ever add Co-Authored-By in a commit.
