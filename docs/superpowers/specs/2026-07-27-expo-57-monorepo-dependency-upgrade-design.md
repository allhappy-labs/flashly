# Expo 57 and Monorepo Dependency Upgrade Design

## Goal

Upgrade Flashly from Expo SDK 54 to Expo SDK 57 and update dependencies across every workspace. Prefer the latest stable release, including new major versions. If a non-mobile major release has a serious compatibility problem with the repository's framework or toolchain, use the newest compatible release from its current major and document the exception.

The upgrade must preserve existing product behavior. In particular, the mobile app must remain local-first by default, hosted mode must remain explicit, and Expo config must remain the source of truth for `.flashly` document associations.

## Approach

Perform the work in compatibility-oriented stages while delivering one coherent final dependency graph:

1. Record the baseline state and run focused checks before changing dependencies.
2. Upgrade Expo incrementally through SDK 55, SDK 56, and SDK 57. At each SDK boundary, use Expo's supported dependency alignment and diagnostic commands so failures can be attributed to a specific transition.
3. Align React, React Native, Expo modules, and native ecosystem dependencies with Expo SDK 57.
4. Upgrade the remaining workspaces in related families: root tooling, API and authentication, frontend and Storybook, promo and Astro, email templates, and shared packages.
5. Resolve source-level migrations caused by supported major upgrades.
6. Regenerate the lockfile and run repository-wide verification.

This staged approach is preferred over one bulk update because it keeps compatibility failures attributable. It is preferred over separate branches because the monorepo has one lockfile and shared React, TypeScript, authentication, and API dependencies.

## Version Policy

- Expo SDK 57 is mandatory.
- Expo-controlled packages use the versions selected by `expo install --fix`, even if an unrelated registry version appears newer.
- React and React Native use the versions required by Expo SDK 57.
- The root Node.js engine floor becomes at least `22.13`, matching Expo SDK 57. The package manager version is updated if the latest stable version supports the resulting toolchain and lockfile.
- All other direct dependencies are upgraded to their latest stable versions by default.
- Related packages are upgraded together, including Better Auth, tRPC, TanStack, Storybook, React Email, Astro, Vite, and AWS SDK families.
- Pre-release, beta, RC, and canary versions are excluded unless Expo SDK 57 explicitly requires one.
- A non-mobile dependency may remain within its current major only when the latest major causes a demonstrated serious compatibility issue, such as an incompatible peer range, unsupported runtime/toolchain combination, or migration that would require product redesign outside this task.
- Every exception records the attempted version, observed incompatibility, and selected fallback version.

## Mobile and Native Constraints

The mobile app uses Continuous Native Generation. Generated `ios/` and `android/` projects are not sources of truth and must not be committed as part of the dependency upgrade.

The upgrade must preserve:

- exact `EXPO_PUBLIC_APP_MODE=hosted` opt-in behavior;
- local-first default startup and storage;
- `CFBundleDocumentTypes`, `UTExportedTypeDeclarations`, `com.flashly.deck`, and the `.flashly` filename extension in generated iOS configuration;
- Android intent filters for imported deck files;
- image, audio, SQLite, secure storage, sharing, and document-picker behavior;
- the existing `expo prebuild --platform ios --no-install` flow before an iOS run.

Breaking changes in Expo FileSystem or other Expo modules should be migrated in application code rather than bypassed with legacy native edits.

## Error Handling and Compatibility Decisions

Upgrade failures are handled at the smallest dependency-family boundary:

1. Confirm whether the failure is a dependency alignment, peer dependency, type, build, test, or runtime issue.
2. Apply the documented migration when it remains within dependency-upgrade scope.
3. For non-mobile majors only, fall back to the newest release in the existing major if the incompatibility is serious and cannot be resolved without unrelated product changes.
4. Do not weaken validation, remove tests, add broad dependency overrides, or use type assertions to conceal incompatibilities.

Expo SDK 57 and its required native dependency versions do not use the fallback rule.

## Verification

Verification proceeds from focused checks to the full repository:

- clean dependency installation with the regenerated lockfile;
- `expo install --check` and `expo-doctor`;
- mobile type checks and tests, including Expo public-config regression coverage;
- Expo config inspection after prebuild;
- iOS native generation and build using the installed Xcode 26.6;
- tests and builds for API, frontend, promo, email templates, and shared packages;
- `pnpm validate`;
- `pnpm verify`;
- a final outdated-dependency inventory identifying only documented compatibility exceptions.

Native generation or compilation proves build compatibility, not physical-device behavior. Any manual Simulator or device checks performed will be reported separately.

## Deliverables

- Updated workspace manifests and root toolchain requirements.
- Regenerated `pnpm-lock.yaml`.
- Source migrations required by dependency upgrades.
- Preserved Expo configuration and focused regression coverage.
- A concise list of any non-mobile major-version exceptions and their evidence.
- Verification results with native, test, and repository-wide checks clearly distinguished.
