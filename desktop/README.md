# Lumen Display

Electron + Vite + React + TypeScript scaffold for Lumen Display running a Setup window and a fullscreen Output window.

## Requirements
- Node.js 18 or newer
- npm 10 or newer
- Git (for cloning and pushing to the FxSteel/display-lumen repo)

## Getting started
```bash
npm install
npm run dev
```

## Building & packaging
```bash
npm run build
npm run dist
```

`npm run dist` outputs macOS `.dmg` and Windows `.nsis` installers via `electron-builder`. Adjust signing/notarization once you add credentials.
