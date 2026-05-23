# Mission Control Center

Mission Control Center is a spatial, HUD-like control surface built with React + TypeScript.

## Status
- Primary shipping target: Windows desktop app through Tauri + React
- Fast preview target: browser-first React + TypeScript through Vite
- Visual direction: translucent, layered, semi-3D command surface
- Priority: UI feel first, features second, with the reel/video references as the visual target
- Interaction model: fluid workspace with free-moving widgets, multi-screen continuity, and no scroll-down pages as the primary navigation pattern
- Current tooling: Vite with strict TypeScript gates (`npm run typecheck` and `npm run build`)
- Planned verification stack: Vitest + React Testing Library, Playwright, and ESLint
- 3D preview lane: React Three Fiber or Three.js, limited to the asset preview surface rather than the shell
- MVP boundary: prove the desktop shell, persistence, visual language, navigation, role gating, and preview lane before expanding live backend wiring
- Preview: `npm run dev` or `npm run preview`

## Development

Requires Node `^20.19.0`, `^22.13.0`, or `>=24`. The Vite 8 toolchain will not build on older Node 20 releases.

```bash
npm ci
npm run dev
```

## Quality checks

```bash
npm run check
```

This runs ESLint, the Vitest suite, and the production build.

## Production build

```bash
npm run build
npm run preview
```

## Windows desktop build

The desktop target uses Tauri v2. Browser preview still uses Vite, but installed desktop builds persist app state through the Tauri app-data adapter instead of browser `localStorage`.

Prerequisites:
- Node `^20.19.0`, `^22.13.0`, or `>=24`
- Rust/Cargo from rustup
- Microsoft C++ Build Tools and WebView2 runtime
- NSIS for the Windows setup `.exe`

```bash
npm run desktop:dev
npm run desktop:build
```

`npm run desktop:build` produces the Windows installer under `src-tauri/target/release/bundle/nsis/` after the Rust/Windows prerequisites are installed.

## Plan
See `docs/plans/2026-05-18-mission-control-center-react-ts.md`.
