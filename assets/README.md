# RelayDeck assets

## Application icon

- `icon.png` is the canonical raster artwork used to generate application icons.
- `icon.svg` preserves the same artwork in an SVG container for design-tool compatibility. Keep it beside `icon.png` because it references that file.
- `../src-tauri/icons/` contains generated platform assets. Do not edit those files individually.

After changing `icon.png`, regenerate every Tauri icon from the project root:

    npm run icon:generate

Commit both the canonical files in this directory and the generated files in `src-tauri/icons/`. This keeps local builds and release builds reproducible without requiring icon-generation tools during packaging.
