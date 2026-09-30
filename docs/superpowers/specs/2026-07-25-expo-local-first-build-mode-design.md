# Expo Local-First Build Mode

**Status:** Approved  
**Date:** 2026-07-25  
**Scope:** `apps/mobile` and shared configuration/documentation needed by the Expo app

## Summary

Flashly's Expo app will become local-first by default. A local build will require no Flashly server and will expose no network-dependent product actions. Authentication, accounts, synchronization, marketplace browsing, remote analytics, hosted help, web generation, remote media, and related UI will remain in the repository and can be restored as one hosted capability bundle at build time.

The build contract will be:

- Missing or invalid `EXPO_PUBLIC_APP_MODE`: `local`
- `EXPO_PUBLIC_APP_MODE=local`: `local`
- `EXPO_PUBLIC_APP_MODE=hosted`: `hosted`

The web app, API, promo site, and existing hosted behavior are not being removed or converted to local-first in this change.

## Goals

- Make the Expo app useful without operating or reaching a Flashly server.
- Make local mode the safe default.
- Hide all hosted-only UI rather than showing disabled controls or upgrade messaging.
- Prevent local startup and user flows from constructing or running network services.
- Preserve the current hosted experience behind one build-time switch.
- Keep local decks, cards, media, scheduling, study history, and analytics on the device.
- Support self-contained `.flashly` archives through Files and OS file association.
- Copy available packaged media into Flashly-owned persistent device storage.
- Import otherwise valid packs even when optional images or audio are unavailable.
- Preserve durable future-sync intent locally so a later hosted build can upload local work.

## Non-goals

- Making the React web app work without the API.
- Adding an in-app pack marketplace or download catalog to local builds.
- Adding a runtime local/hosted toggle.
- Removing API, auth, sync, marketplace, or hosted analytics source code.
- Adding server deployment infrastructure.
- Fetching remote media while importing a pack in local mode.
- Migrating or deleting existing local databases, auth state, or hosted caches.

## Build Configuration

### Single mode source

`apps/mobile/app.config.js` will normalize `EXPO_PUBLIC_APP_MODE` and expose the normalized value through Expo `extra`. Only the exact value `hosted` enables hosted behavior. Every other value produces `local`.

A typed mobile `app-mode` module will read the normalized Expo value and expose:

- `APP_MODE`
- `isHostedMode`
- a frozen capability object for authentication, sync, marketplace, remote analytics, external product links, and remote media

No feature module will independently interpret the environment variable. This keeps local mode fail-closed and prevents different parts of the app from disagreeing about the active mode.

### Hosted configuration

`EXPO_PUBLIC_APP_MODE=hosted` restores the hosted capability bundle as a whole. Existing API and frontend URL settings remain meaningful only in hosted mode.

The repository documentation will show explicit examples for both modes and state that local is the default.

## Runtime Architecture

### Shared bootstrap

Both modes reuse the existing:

- SQLite database and repositories
- local Zustand state
- i18n setup
- theme and safe-area providers
- deck, card, study, import, export, and settings screens
- `.flashly` file association

### Local runtime

The local runtime initializes only:

- auth-independent local preferences
- SQLite
- i18n
- local app state
- navigation
- import/deck deep-link handling

It does not initialize or mount:

- Better Auth or auth storage hydration
- API or TRPC clients/providers
- marketplace clients/services
- sync services or background sync
- NetInfo sync monitoring
- remote analytics
- auth deep-link processing

Separating the local and hosted runtime components avoids conditional React hooks and makes the absence of network startup behavior structurally testable.

### Hosted runtime

The hosted runtime preserves the current initialization order and providers for auth, API, TRPC, marketplace, sync, network monitoring, and session bridging.

Hosted screens and services remain buildable and covered by regression tests. The mode switch changes composition; it does not delete the hosted implementation.

## Navigation and Onboarding

### Local navigation

The local tab bar contains:

- Decks
- Settings

It does not register or render Browse/Marketplace or Account tabs. Auth screens are not part of the local entry flow.

### Hosted navigation

The hosted tab bar and auth gate retain the current Browse, Decks, Account, and Settings behavior.

### Intro

Local mode keeps the intro and language selection, removes the cloud-sync slide, and finishes directly in the local deck library. Hosted mode keeps the current sync-oriented intro and finishes at authentication.

### Incoming links

Local mode accepts:

- `.flashly` file URLs from Files and OS "Open with Flashly"
- local deck routes

It does not parse or navigate auth links. Hosted mode retains the current auth-link behavior.

## Local Data and Future Hosted Sync

SQLite remains the source of truth in local mode for:

- decks and cards
- FSRS scheduling state
- study sessions and review history
- local analytics
- preferences and goals

Local mode continues recording the existing anonymous sync operations and study-event outbox records in SQLite. Recording this intent is a local database action, not a network action. No local-mode service attempts to upload it.

When a later build enables hosted mode and the user authenticates, the existing hosted sync path can claim those anonymous records and upload the accumulated local work. This preserves the user's ability to re-enable hosted functionality without reconstructing local changes from scratch.

All visible sync indicators and controls remain absent from local mode.

## Analytics

Local mode always calls the existing SQLite analytics query over `study_history`, `study_sessions`, and card state. It does not read the server analytics cache, trigger synchronization, or call the analytics API.

Hosted mode retains the current server/cached analytics path and sync refresh behavior.

The analytics screen will select its data source from the central build capabilities rather than inferring it only from the presence of a user ID.

## Network-Dependent UI

Local mode hides:

- authentication and account screens
- marketplace/browse screens
- sync indicators and sync controls
- web/AI generation actions
- Help Center links
- Unsplash links
- image URL input
- audio URL input
- any other product action that requires an HTTP service

Device image and audio pickers remain available. Hosted mode retains the current controls.

User-visible mode-specific and import-summary text must use shared translation keys in every supported locale.

## `.flashly` Import Contract

### Entry points

Users can import a `.flashly` archive by:

- choosing Import from Files inside Flashly
- opening a `.flashly` file with Flashly through the operating system

There is no in-app catalog.

### Validation

Before creating cards, the importer validates:

- a parseable export configuration
- a supported archive/card format
- a JSONL card file
- usable card fronts and backs
- safe archive media paths

Malformed core data fails the import with a localized error.

### Optional media

Images and audio are optional. For each card:

- available packaged media is extracted to a temporary staging area
- staged media is copied into Flashly's persistent app-owned deck-media directory
- the stored card receives the resulting persistent local URI
- missing packaged media is cleared from that card
- remote media URLs are ignored and cleared in local mode without being fetched

Missing optional media does not fail an otherwise valid import. The completion message reports the imported card count and unavailable image/audio counts.

Temporary extraction files are removed after success or failure. If persistence fails partway through, the importer cleans up partial media and avoids leaving a partially imported deck where practical.

### Export and round trip

The existing mobile export remains available. It creates a `.flashly` archive containing card data plus readable local image/audio files. Export never needs a Flashly server.

Round-trip verification must prove that available packaged images and audio survive export, Files import, app restart, and local playback/rendering. Optional media that is already missing does not block archive use.

## Error Handling

- Invalid mode values fail safely to local mode.
- Hosted-only services are absent rather than returning "service unavailable" in local UI.
- Core archive errors stop import before deck creation.
- Optional media problems are summarized after a successful import.
- Local media copy failures are counted as unavailable media when the rest of the pack can still be imported safely.
- All new user-facing errors and summaries are localized.
- No local-mode fallback attempts a remote request.

## Backward Compatibility

- No database reset is required.
- Existing local decks and media remain available.
- Existing auth material may remain stored but is not read by local startup.
- Existing remote media references are not fetched by local mode; they render as unavailable until replaced with device media or re-entered in hosted mode.
- Switching back to hosted mode restores the existing auth and server feature composition.
- Anonymous sync/outbox records accumulated in local mode remain claimable after hosted authentication.

## Testing and Acceptance

### Configuration tests

- missing mode resolves to local
- `local` resolves to local
- `hosted` resolves to hosted
- invalid and differently cased values resolve to local
- the capability bundle matches the selected mode

### Local runtime tests

- local startup does not construct auth, API, TRPC, sync, marketplace, NetInfo, or remote analytics services
- local navigation registers only Decks and Settings
- intro omits sync messaging and enters the local library
- auth links do not enter an auth flow
- hosted-only buttons and URL fields are absent
- deck/card/review mutations remain local and create durable anonymous future-sync intent without executing sync
- analytics uses only SQLite

### Archive tests

- Files picker accepts `.flashly`
- incoming `.flashly` file URLs navigate to import
- packaged images and audio are copied to persistent app-owned paths
- cards reference persistent local URIs after import
- missing image and audio entries do not fail import
- missing-media counts appear in the completion summary
- remote URLs are cleared without a fetch
- malformed core archives fail cleanly
- export/import round trip retains available image and audio media

### Hosted regression tests

- hosted startup initializes the existing providers and services
- hosted auth gate and full tab bar remain present
- hosted sync and remote analytics selection remain available
- hosted media URL and external product actions remain available

### Repository verification

After implementation:

- run focused mobile tests while iterating
- run `pnpm validate`
- run `pnpm verify`
- manually exercise the local Expo app, including a `.flashly` pack with media and another with missing media
- manually confirm the local UI contains no hosted-only controls

## Implementation Boundaries

This work should prefer small mode-aware composition points over scattered environment checks. Hosted source files remain intact unless a shared component needs an explicit capability prop. Unrelated frontend, API, promo, and package behavior stays out of scope.
