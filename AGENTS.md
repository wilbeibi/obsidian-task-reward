# Task Reward Plugin — Agent Notes

## Build & Release
- Always run `npm install` once before development.
- Build for release with `npm run build`; this runs TypeScript checks then bundles `main.js` via esbuild.
- Keep `manifest.json` and `package.json` version numbers in sync, and include the generated `main.js` in commits.

## Obsidian Best Practices
- Respect user preferences: the plugin already checks the "reduce motion" media query and provides enable/mute toggles.
- Avoid blocking the UI thread; confetti rendering uses `requestAnimationFrame` and the audio path is asynchronous.
- Use Obsidian APIs where available (e.g., `metadataCache.on('changed')`) instead of polling files.
- Guard DOM access: confetti and audio loaders ensure elements exist and fall back gracefully.

## Repository Hygiene
- Do not commit `node_modules/` or local vault data (`data.json`).
- Tests are manual; when making changes run `npm run build` and verify the Settings → Task Reward test buttons inside Obsidian.
- Releases should bundle `manifest.json`, `main.js`, and audio assets in `sound/`.

These notes help agents or collaborators keep the plugin production-ready without unexpected regressions.
