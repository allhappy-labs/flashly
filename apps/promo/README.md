# Flashly Promo Website

Promo site for Flashly built with Astro + Tailwind, based on the Astroplate multilingual starter.

## Local development

```bash
pnpm install
pnpm --filter ./apps/promo dev
```

## Build

```bash
pnpm --filter ./apps/promo build
```

## Notes

- Brand tokens live in `packages/branding`.
- Theme generation pulls from `@flashly/branding/theme.json`.
- Content lives in `apps/promo/src/content`.
