# Claude Code Guide

## Quick Start

For detailed information about project structure, development commands, coding conventions, and workflows, please refer to **[AGENTS.md](./AGENTS.md)**.

## Key Information

- **Monorepo**: Built with pnpm workspaces and Turborepo
- **Package Manager**: pnpm (required)
- **Node Version**: >= 18
- **Apps**: Frontend (React/Vite), Mobile (Expo/React Native), API (Fastify), Promo (Astro)
- **Shared**: Utilities, branding, and i18n in `packages/`
- **Git Commits**: Do not ever add Co-Authored-By in a commit messages.

## Coding Conventions

### Error Handling

- **Use `neverthrow` for all async operations**: All async functions that can fail should return `ResultAsync<T, E>` from the `neverthrow` library
- Import error types from `@flashly/shared`: `NetworkError`, `ExternalServiceError`, `ValidationError`, etc.
- Use `errorFactory` from `@flashly/shared` to create typed errors
- Example:
  ```typescript
  import { ResultAsync } from 'neverthrow';
  import { errorFactory, NetworkError } from '@flashly/shared';

  const fetchData = (): ResultAsync<Data, NetworkError> => {
    return ResultAsync.fromPromise(
      fetch('/api/data'),
      (error) => errorFactory.network('Failed to fetch data', { cause: error })
    );
  };
  ```

### Testing

- Use **Vitest** as the test framework (project standard)
- Use `vi.fn()` for mocking functions
- Place test files next to source files with `.test.ts` suffix

## Documentation

See [AGENTS.md](./AGENTS.md) for:
- Project structure details
- Full development command reference
- Coding conventions and style guide
- Localization guidelines
- Debugging practices
- Git workflow and PR guidelines
