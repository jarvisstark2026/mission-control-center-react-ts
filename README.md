# Mission Control Center

Mission Control Center is a spatial, HUD-like control surface built with React + TypeScript.

## Status
- Active build: browser-first React + TypeScript
- Visual direction: translucent, layered, semi-3D command surface
- Priority: UI feel first, features second, with the reel/video references as the visual target
- Interaction model: fluid workspace with free-moving widgets, multi-screen continuity, and no scroll-down pages as the primary navigation pattern
- Tooling: Vite, Vitest + React Testing Library, Playwright, ESLint, and strict TypeScript gates
- 3D preview lane: React Three Fiber or Three.js, limited to the asset preview surface rather than the shell
- MVP boundary: prove the shell, visual language, navigation, role gating, and preview lane before expanding packaging or live backend wiring
- Preview: `npm run dev` or `npm run preview`

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Plan
See `docs/plans/2026-05-18-mission-control-center-react-ts.md`.
