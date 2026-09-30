# Layered Flashly App Icon

**Status:** Approved
**Date:** 2026-07-26
**Scope:** Flashly's Expo launcher icon, Apple Icon Composer source, and matching cross-platform icon exports

## Summary

Flashly will replace its current blue card-stack launcher icon and the unused flattened rainbow-star experiment with one coherent app-icon design: three layered flashcards with a clean orange lightning bolt.

The Apple source of truth will be an editable Icon Composer `.icon` package. Its artwork will remain vector-based and separated into four full-canvas SVG depth groups. Expo SDK 54 will consume this package directly through `ios.icon`. Matching flattened exports will keep Android, web, splash, and other non-Composer surfaces visually consistent.

## Goals

- Preserve the approved white-card composition and clean orange lightning silhouette.
- Keep every meaningful visual element editable as vector source.
- Use all four available Icon Composer depth groups intentionally.
- Let Icon Composer provide platform masks, depth, shadows, and Liquid Glass effects.
- Support Default, Dark, and Mono appearance modes from one `.icon` package.
- Use the `.icon` package directly in the Expo iOS configuration.
- Commit deterministic flat exports for platforms and surfaces that cannot consume `.icon`.
- Verify the real generated iOS project and installed Simulator icon, not only the source files.

## Non-goals

- Redesigning the Flashly wordmark or horizontal logo.
- Changing the blue and orange product color tokens.
- Reworking unrelated mobile branding, navigation, or onboarding.
- Replacing Android's adaptive-icon mechanism with Apple-specific assets.
- Baking Apple masks, shadows, highlights, refraction, or blur into the source SVG artwork.

## Approved Face Design

The icon face contains:

1. A rear rounded flashcard with a restrained blue-to-green-to-yellow-to-coral color transition.
2. A middle white flashcard rotated slightly counterclockwise.
3. A front white flashcard aligned close to upright.
4. A centered, forward-leaning lightning bolt in Flashly's established orange.

The face contains no text, gray text line, white highlight line, or star. The bolt is a clean uninterrupted silhouette. The composition leaves enough outer breathing room for Apple's rounded-square and circular platform masks.

## Source of Truth

The canonical Apple source will live at:

`apps/mobile/assets/app.icon/`

The package will contain four numbered, meaningfully named SVG files under its `Assets` directory:

- `01-rear-color-card.svg`
- `02-middle-card.svg`
- `03-front-card.svg`
- `04-lightning-bolt.svg`

Each SVG uses the same 1024 by 1024 transparent canvas. Coordinates are final in the source so importing or replacing a layer does not require manual repositioning. The files contain geometry and intrinsic color only.

`icon.json` records the Composer annotations and remains version-controlled with the SVGs. A short source note beside the package will document layer order, approved colors, flat-export targets, and the command or tool used to regenerate exports.

## Composer Group Architecture

The design uses four rendered groups, ordered from back to front:

1. Rear color card
2. Middle white card
3. Front white card
4. Orange lightning bolt

Each group contains exactly one SVG layer. This gives every card independent depth, parallax, shadow, and material control while keeping the package within Icon Composer's four-group limit.

The package background is a very light cool neutral rather than a rounded rectangle drawn into the artwork. Apple applies the final enclosure mask for each platform.

## Liquid Glass Treatment

The three card groups use restrained Liquid Glass:

- subtle neutral shadows establish separation without creating a floating sticker effect
- low translucency preserves the identity of the white cards
- conservative refraction keeps card edges crisp at small sizes
- automatic edge specular treatment provides material presence without baked highlights

The lightning group stays opaque orange. It has no internal highlight, no white stroke, no specular treatment, and no visible glass refraction. It uses one low-opacity neutral shadow so the bolt remains the highest-contrast focal shape.

Effects are tuned in Icon Composer rather than encoded in SVG filters. This lets the system render appropriate material behavior across platforms and future appearance updates.

## Appearance Modes

### Default

- Light cool-neutral background
- White front and middle cards
- Full-color rear card
- Opaque orange lightning bolt

### Dark

- Darker cool background chosen for clear card silhouettes
- Cards retain enough brightness to read as paper without glaring
- Rear-card color remains visible but avoids oversaturation
- Bolt remains the same recognizable orange

### Mono

- All four groups remain distinct through tonal value and opacity
- The lightning bolt stays the strongest foreground silhouette
- No information depends on the rear-card rainbow colors
- Contrast is checked across light and dark user-selected tint colors

## Expo Integration

The installed mobile app uses Expo SDK 54.0.31, which supports an Icon Composer directory through `ios.icon`.

`apps/mobile/app.json` will set:

```json
{
  "expo": {
    "ios": {
      "icon": "./assets/app.icon"
    }
  }
}
```

The existing top-level `icon` remains a committed 1024 by 1024 flattened PNG for Expo surfaces that do not consume Icon Composer.

Android keeps a proper adaptive-icon split:

- transparent foreground artwork without a baked outer mask
- configured background color or image
- a matching legacy flattened icon for launchers without adaptive-icon support

The favicon and splash mark use flattened exports of the same approved composition. The splash export omits the launcher enclosure so the mark can sit naturally on the existing splash background.

References:

- [Apple: Creating your app icon using Icon Composer](https://developer.apple.com/documentation/Xcode/creating-your-app-icon-using-icon-composer)
- [Apple: Icon Composer](https://developer.apple.com/icon-composer/)
- [Expo: Splash screen and app icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)

## Export Contract

Committed exports are generated from the approved vector geometry and must not be hand-edited after export.

Required outputs:

- 1024 by 1024 flattened Expo icon
- Android adaptive foreground
- Android legacy icon
- web favicon source
- splash mark
- a flattened review image exported from Icon Composer

The source note records the exact regeneration workflow. Exported icons must not contain transparent pixels where Expo or Apple requires an opaque square, and adaptive foreground artwork must preserve safe-zone padding.

## Error Handling and Migration

- Expo configuration validation must fail if `ios.icon` does not resolve to the committed `.icon` package.
- The implementation does not remove the currently shipped PNG until matching fallbacks exist.
- After the new package opens and builds successfully, remove the obsolete duplicate Composer package and superseded icon PNGs from the working tree. Their source remains recoverable from Git history.
- If Icon Composer rejects an SVG feature, simplify that vector geometry rather than replacing the layer with a lossy raster image.
- If an appearance mode loses contrast, adjust that mode's Composer annotations without changing the approved face geometry.

## Verification

### Source checks

- Confirm all four SVGs use the same 1024 by 1024 canvas.
- Confirm no layer contains a baked mask, blur, drop shadow, or highlight.
- Confirm the bolt contains no white line or internal decoration.
- Confirm `icon.json` references every asset exactly once in the approved back-to-front order.

### Composer checks

- Open the committed `.icon` package in the current Icon Composer version.
- Preview Default, Dark, and Mono.
- Preview iPhone, iPad, Mac, and Watch masks.
- Inspect small-size previews for bolt legibility, card separation, and clipping.
- Export a flattened review image and compare it with the approved face design.

### Expo and native checks

- Resolve the public Expo configuration and confirm `ios.icon` points to `./assets/app.icon`.
- Run the mobile configuration tests without overwriting unrelated work.
- Generate the iOS project through Expo prebuild and verify the `.icon` package is present in the generated Xcode target.
- Build and install the app on an iOS Simulator.
- Inspect the Home Screen, Spotlight, Settings, and notification-size icon where available.
- Check Android adaptive-icon safe zones and the web favicon from their committed fallbacks.

### Repository checks

- Run focused icon/config checks during implementation.
- Run `pnpm validate` and `pnpm verify` before the implementation commit.
- Commit only the icon source, generated fallbacks, configuration, tests or documentation added for this work.
- Preserve all unrelated staged and unstaged changes.

## Acceptance Criteria

- The committed `.icon` package opens in Icon Composer with four editable vector groups.
- The visual matches the approved white-card composition and clean orange bolt.
- Default, Dark, and Mono variants remain legible across supported Apple masks.
- Expo resolves the `.icon` package through `ios.icon`.
- Matching committed fallbacks are used by Android, web, and splash surfaces.
- A generated iOS project builds successfully with the Composer icon.
- Simulator evidence confirms the installed app uses the new icon.
- The implementation and its source are committed without including unrelated work.
