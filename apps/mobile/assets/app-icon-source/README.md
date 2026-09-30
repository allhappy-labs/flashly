# Flashly app icon source

`../app.icon` is the canonical Apple Icon Composer source. Its four SVG
layers are numbered back to front and share a 1024 by 1024 canvas.

Regenerate non-Composer exports from the repository root:

`bash apps/mobile/scripts/generate-app-icon-assets.sh`

The generator assembles temporary inline SVG documents from the canonical
layers before rendering. This avoids duplicating geometry and works around
`librsvg` not rendering nested SVG files through `<image>`.

Do not hand-edit generated PNG files. Tune Apple-only material, depth, and
appearance variants in Icon Composer; keep geometry and intrinsic colors in the
SVG layers.
