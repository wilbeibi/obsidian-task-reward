# Task Reward — Obsidian Plugin

Give yourself an instant celebration every time you complete a task in Obsidian. Task Reward plays a short audio cue and launches a burst of confetti straight from the checkbox you just ticked.

https://github.com/hongyis/obsidian-task-reward/assets/demo-confetti.gif

## Features

- 🔊 Reward sound (`sound/reward.m4a`) on every completed checkbox.
- 🎉 Confetti burst rendered right on top of the finished task line.
- 🛡️ Respects system "Reduce Motion" and the plugin's own enable/disable toggles.
- ⚙️ Undo protection to avoid double-triggering when you quickly uncheck and recheck.

## Installation

1. Download the latest release from the [Releases](https://github.com/hongyis/obsidian-task-reward/releases) page.
2. Extract the archive into `<your-vault>/.obsidian/plugins/task-reward/` (create the folder if it does not exist).
3. Launch Obsidian → **Settings → Community plugins** → Enable **Task Reward**.
4. Open **Settings → Task Reward** for quick toggles and test buttons.

### Manual build & install

```bash
npm install
npm run build
./deploy.sh /path/to/your/vault
```

The deploy script copies the compiled plugin files and bundled audio into the vault directory you provide.

## Development

- `npm run dev` – start esbuild in watch mode for rapid feedback.
- `npm run build` – type-check with TypeScript and produce `main.js` for release.
- Edit `sound/reward.m4a` (or add a `reward.mp3`) to customize your celebration.

Source files live alongside the bundle:

- `main.ts` – plugin entry point and task detection.
- `sound.ts` – resilient audio loader (Web Audio + HTML5 + synth fallback).
- `confetti.ts` – canvas-based confetti renderer.
- `settings.ts` – Obsidian setting tab.

## Release checklist

1. Run `npm run build` to refresh `main.js`.
2. Update `manifest.json` and `package.json` version numbers together.
3. Commit `manifest.json`, `package.json`, `main.js`, `README.md`, and `sound/reward.m4a`.
4. Tag the release (`git tag vX.Y.Z`) and create a GitHub release attaching `manifest.json`, `main.js`, and `styles.css` (if added later).

## License

MIT © wilbeibi
