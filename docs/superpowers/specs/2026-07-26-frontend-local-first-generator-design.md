# Frontend Local-First Generator

**Status:** Approved
**Date:** 2026-07-26
**Scope:** `apps/frontend` and shared localization or documentation required by the frontend

## Summary

Flashly's frontend card generator will run without the Flashly backend by default. It will call OpenRouter, ElevenLabs, and Unsplash directly from the browser using provider credentials that the user saves in browser `localStorage`.

The current hosted application, including Flashly API calls, authentication, accounts, persisted decks, billing, quotas, pricing, and feature flags, will remain in the repository. Setting `VITE_APP_MODE=hosted` will restore that hosted application as one capability bundle.

The build contract will be:

- Missing, empty, or invalid `VITE_APP_MODE`: `local`
- `VITE_APP_MODE=local`: `local`
- `VITE_APP_MODE=hosted`: `hosted`

Only the exact value `hosted` enables Flashly backend behavior.

## Goals

- Make the frontend generator useful without running or reaching the Flashly API or authentication service.
- Make local mode the fail-closed default.
- Let users save OpenRouter, ElevenLabs, and Unsplash credentials in browser `localStorage`.
- Keep direct browser generation, translation, audio, image search, editing, import, and download flows available.
- Hide all hosted account, quota, spend, pricing, subscription, upgrade, and billing UI in local mode.
- Preserve the current hosted frontend behavior behind one build-time mode.
- Prove through automated and live browser checks that local mode does not call a Flashly backend origin.

## Non-Goals

- Removing hosted frontend, API, authentication, billing, deck persistence, or marketplace source code.
- Adding a runtime mode switch.
- Persisting generated decks in a new local database.
- Synchronizing `localStorage` credentials across devices.
- Encrypting browser `localStorage`.
- Proxying provider traffic through another service.
- Removing the generator's technical safety constraints, including the 300-card-per-run maximum.
- Changing the mobile application or API service.

## App Mode

### Single mode source

A typed frontend app-mode module will normalize `VITE_APP_MODE` once and export:

- the normalized app mode
- `isHostedMode`
- a frozen capability object for Flashly API access, authentication, hosted navigation, hosted deck persistence, billing and quota UI, remote feature flags, and direct provider access

Feature modules will consume these capabilities rather than interpret `VITE_APP_MODE` independently. Unknown values remain local so a misspelled or omitted setting cannot enable backend traffic.

### Local bootstrap

Local mode will initialize only browser-local application dependencies:

- i18n
- theme
- error boundaries
- toasts
- the local generator router and page
- browser-local provider settings

It will not initialize or mount:

- the Flashly REST or tRPC client
- Better Auth
- Autumn billing
- remote GrowthBook feature loading
- authenticated queries
- hosted deck services

Hosted modules should be selected through explicit composition and dynamically imported where practical so local startup does not execute hosted initialization as a side effect.

### Hosted bootstrap

`VITE_APP_MODE=hosted` will preserve the existing initialization and provider order for the API client, tRPC, React Query, Better Auth, Autumn, GrowthBook, hosted router, and all existing hosted screens.

The mode switch changes composition. It does not remove the hosted implementation.

## Routing and Navigation

### Local mode

Local mode opens directly to the generator and registers only local generator routes. It contains:

- Flashly branding
- language switching
- theme behavior
- provider settings
- the card generator and results

It does not register or render:

- login or onboarding
- dashboard
- account
- billing or pricing
- quota, usage, or spend displays
- My Decks
- marketplace
- deck analytics
- hosted deck editor routes

Old authentication state in browser storage must not change local routing or trigger session checks.

### Hosted mode

Hosted mode keeps the current public and secured route trees, navigation, authentication redirects, account surfaces, dashboard, pricing, billing, marketplace, persisted decks, analytics, and deck editor.

## Generator Capabilities

### Available in local mode

The local generator supports:

- text and multilingual card generation
- bulk generation without depending on a remote GrowthBook feature flag
- local `.txt`, `.md`, and `.flashly` import
- in-browser card editing and removal
- OpenRouter translation requests
- ElevenLabs audio generation
- Unsplash image search and selection
- `.flashly`, Anki CSV, and Quizlet text downloads
- interruption, progress, retry, and partial-result behavior already present in the generator

The technical 300-card-per-run maximum remains.

### Hidden in local mode

Local mode hides:

- Add to My Decks
- append-to-hosted-deck mode and hosted deck preloading
- hosted account, quota, spend, pricing, subscription, upgrade, and billing actions
- any other action whose implementation requires the Flashly backend

Hosted-only actions are removed from local composition rather than shown disabled.

### Hosted behavior

Hosted mode retains Add to My Decks, append mode, authenticated deck storage, hosted feature flags, and all existing account and commercial behavior.

## Provider Settings

The generator settings surface will manage:

- OpenRouter API key
- OpenRouter model
- ElevenLabs API key
- ElevenLabs voice
- ElevenLabs model
- Unsplash access key

Local mode stores these values under stable Flashly-namespaced `localStorage` keys without requiring a user ID. Saving trims values. Clearing a credential removes its storage entry. Existing anonymous OpenRouter and ElevenLabs fallback keys remain readable so the change does not discard current browser settings.

Hosted mode keeps the existing user-scoped storage behavior and fallback migration rules.

All user-visible labels, help text, success messages, and errors use keys from `packages/shared/src/i18n` in every supported locale. The settings UI explains that credentials remain in the current browser and are sent directly to the selected external provider.

Browser `localStorage` is not encrypted. The UI must not claim stronger protection.

## Provider Data Flow

### OpenRouter

Card generation, deck translation, and generated deck-name translation call OpenRouter from the browser using the saved key and selected model. Requests retain the existing Flashly title and browser origin headers.

Missing keys prevent the relevant action and open provider settings. Failures do not fall back to a Flashly endpoint.

### ElevenLabs

Audio generation calls ElevenLabs directly using the saved key, voice, and model. Local mode does not use the Flashly TTS proxy. A missing key prevents audio generation and opens provider settings.

Hosted mode may retain its existing proxy fallback.

### Unsplash

Local image search calls the Unsplash API directly with the saved access key in the `Authorization: Client-ID <key>` header. Search results retain the image, author, attribution, and `download_location` data needed by the existing UI.

When an image is used, local mode calls the provider-supplied Unsplash download endpoint directly to satisfy Unsplash download tracking requirements. It does not call the Flashly Unsplash search or tracking proxy.

A missing key prevents image search or generation and opens provider settings. Provider or CORS failures surface as translated Unsplash-specific errors and do not fall back to Flashly.

Hosted mode retains its current Flashly Unsplash proxy behavior.

## Error Handling

- Missing credentials block only the provider-dependent action.
- Provider errors identify the affected service without rendering, logging, or including credential values.
- Local mode never falls back to a Flashly URL after a provider error.
- Interrupted operations keep the current cancellation and partial-result behavior.
- Invalid or unavailable stored settings fall back to safe empty values and the default OpenRouter model.
- Direct provider failures leave already generated cards and media intact.

## Testing and Verification

### Unit and component tests

Focused tests will cover:

- app-mode normalization and fail-closed capabilities
- local and hosted bootstrap selection
- anonymous provider credential persistence, trimming, and removal
- preservation of existing OpenRouter and ElevenLabs fallback storage
- direct Unsplash request URL, authorization header, abort signal, result mapping, and download tracking
- the absence of Flashly proxy fallback in local mode
- hiding hosted generator actions in local mode
- retaining hosted generator actions in hosted mode
- enabling local bulk generation without remote feature flags
- routing local mode away from hosted screens

Tests will be written first and observed failing before production changes.

### Browser verification

A local-mode Playwright pass will:

1. Start the frontend without the API service.
2. Open the default route and confirm the generator renders without auth loading or errors.
3. Open settings, save provider values, reload, and confirm they persist.
4. Confirm account, pricing, billing, quota, usage, spend, upgrade, Add to My Decks, and append controls are absent.
5. Exercise local import, editing, and download behavior.
6. Record browser network requests and fail if any request targets the configured Flashly API or auth origin.
7. Confirm provider-bound actions target only OpenRouter, ElevenLabs, or Unsplash.

A hosted-mode build and focused regression pass will confirm:

- API and tRPC initialization remain available
- auth and hosted providers mount
- hosted routes compile and remain registered
- Add to My Decks and append behavior remain available

### Repository gates

After implementation:

- run focused frontend tests throughout the test-driven changes
- run `pnpm validate`
- run `pnpm verify`
- perform the live Playwright verification after the frontend is running

## Documentation

Frontend documentation and environment examples will state:

- local mode is the default
- no Flashly backend is required in local mode
- `VITE_APP_MODE=hosted` restores the hosted application
- provider keys are stored unencrypted in the current browser's `localStorage`
- local mode communicates directly with OpenRouter, ElevenLabs, and Unsplash
- the Flashly backend, auth, hosted deck storage, billing, quota, and pricing surfaces are unavailable in local mode
