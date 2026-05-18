# Mission Control Center React + TypeScript Implementation Plan

> **For Hermes:** Use `subagent-driven-development` to execute this plan task-by-task.

**Goal:** Rebuild Mission Control Center as a spatial, HUD-like command surface in React + TypeScript, but **start with the feel and visual language first**. The first job is to match the cinematic, translucent, layered, micro-detailed control surface shown in the reference videos: floating widgets, dense technical readouts, thin-line diagrams, glassy panels, depth, motion, and a premium cockpit-like composition. Features come after the visual language proves itself.

**Architecture:** Build a browser-first React + TypeScript app with a strict design system, local state boundaries, and a render layer that can handle translucent surfaces, dense micro-detail, motion, and selective 3D previews. Use the web stack for the visual shell and interactive control surface first; only after the UI feels right should we expand into deeper features, backend wiring, desktop/mobile packaging, and richer agent workflows.

**Tech Stack:** React, TypeScript, Vite, CSS variables / design tokens, Framer Motion, Three.js or React Three Fiber for 3D preview panes, Zustand for client state, TanStack Query for server state, WebSocket/SSE for live updates, Tauri for desktop packaging, Capacitor or a mobile wrapper later if needed.

**Verification Stack:** Vitest, React Testing Library, Playwright, ESLint, TypeScript `--noEmit`.

**MVP Boundary:** The first release proves the shell, visual system, and one convincing asset/3D preview lane. Chat, voice, integrations, and packaging beyond browser are permitted only after the shell feels right in browser review and the UI style is accepted.

**Backend Contract Assumptions:** The UI should treat backend data as versioned contracts, not ad hoc blobs. Use a single auth/session model, role claims from the session token, and explicit endpoints or channels for status, commands, telemetry, and registry data. If SSE vs WebSocket is undecided, lock one transport per slice before implementation.

**UI Principles:** The interface must be highly fluid, with no scroll-down pages as the primary interaction model. Screens should behave like movable workspaces: panels, widgets, and controls can be dragged, resized, snapped, and moved across multiple screens. When the user asks Jarvis to open something, it should appear immediately in the appropriate place rather than being buried in navigation. Multi-screen continuity is a core requirement, not a future enhancement.

---

## Phase 0: Lock the execution decisions

### Task 0: Freeze the technical choices and success criteria

**Objective:** Remove ambiguity before implementation starts so the stack and verification path are not re-decided mid-build.

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-05-18-mission-control-center-react-ts.md`

**Step 1: Record the chosen tooling**
- Browser-first React + TypeScript + Vite.
- Vitest + React Testing Library for unit/component tests.
- Playwright for browser smoke and visual checks.
- ESLint and TypeScript strict mode as blocking gates.

**Step 2: Record the visual subsystem decision**
- Use React Three Fiber or Three.js for the 3D preview lane, not the whole UI shell.

**Step 3: Record the MVP boundary**
- First prove shell + visual language + nav + role gating + preview lane.
- Defer mobile packaging and live backend wiring if they threaten the first visual pass.

**Step 4: Verify the plan is executable**
- Expected: each later task has a known test path and no unresolved platform choice.

## Phase 1: Re-establish the product skeleton and visual language first

### Task 1: Create the React + TypeScript workspace

**Objective:** Scaffold a clean browser-first repository with the project structure, scripts, and baseline dependencies.

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`

**Step 1: Write the scaffold**
- Create a minimal React app entry with a dark root shell and the first design tokens.

**Step 2: Run the app**
- Command: `npm install`
- Command: `npm run dev`
- Expected: a blank but styled shell loads in the browser without errors.

**Step 3: Verify structure**
- Confirm `src/` is the only place for app code and that the shell renders a centered mission-control frame.

### Task 2: Build the design system primitives

**Objective:** Create the reusable glass, panel, chip, rail, and heading primitives that define the visual language.

**Files:**
- Create: `src/components/ui/GlassPanel.tsx`
- Create: `src/components/ui/StatusChip.tsx`
- Create: `src/components/ui/SectionHeader.tsx`
- Create: `src/components/ui/ActionButton.tsx`
- Create: `src/styles/components.css`

**Step 1: Write component contracts**
- Define props for tint, depth, blur, border strength, and selected state.

**Step 2: Implement minimal styling**
- Use CSS variables for palette, borders, glow, and translucency.

**Step 3: Verify in the browser**
- Expected: the primitives look like layered system parts, not generic cards.

### Task 3: Add the spatial shell and role-aware navigation

**Objective:** Recreate the main shell with left rail navigation, central command surface, and role-based visibility.

**Files:**
- Create: `src/features/shell/Shell.tsx`
- Create: `src/features/shell/nav.ts`
- Create: `src/features/shell/roles.ts`
- Modify: `src/App.tsx`

**Step 1: Write failing tests or type checks**
- Ensure the shell supports admin / home user / guest / support scopes.

**Step 2: Implement visibility rules**
- Hide or lock surfaces based on role.

**Step 3: Verify**
- Expected: the navigation feels like an operations rail, not a menu bar.

## Phase 2: Prove the visual language

### Task 4: Build the HUD stress-test screen

**Objective:** Create the first demanding visual slice with semi-transparent 3D-like surfaces, dense micro-detail, and motion. Treat the reel-style reference as the target: layered glass, technical overlays, floating depth, a cinematic control-room composition, and a fluid workspace that does not depend on scroll-down pages.

**Files:**
- Create: `src/features/visual-lab/VisualLab.tsx`
- Create: `src/features/visual-lab/OrbPreview.tsx`
- Create: `src/features/visual-lab/BackdropGrid.tsx`
- Create: `src/features/visual-lab/visualLab.css`

**Step 1: Create the test composition**
- Use layered glass panels, perspective transforms, animated glow, and a central asset preview.

**Step 2: Add motion**
- Use Framer Motion for subtle drift, hover parallax, and panel reveal.

**Step 3: Verify performance and feel**
- Expected: the UI reads as a new control surface, not a standard dashboard.

### Task 5: Build the 3D asset preview lane

**Objective:** Prove React can handle the 3D-like asset preview requirement cleanly.

**Files:**
- Create: `src/features/assets/AssetPreviewPane.tsx`
- Create: `src/features/assets/AssetScene.tsx`
- Create: `src/features/assets/assetPreview.css`

**Step 1: Choose the rendering path**
- Prefer Three.js or React Three Fiber for the preview lane.

**Step 2: Implement a minimal scene**
- Render one asset with semi-transparent surfaces, lights, and camera motion.

**Step 3: Verify**
- Expected: the preview feels cinematic enough without contaminating the rest of the app.

### Task 6: Establish live telemetry and data surfaces

**Objective:** Add charts, system state, and notification streams so the UI feels alive.

**Files:**
- Create: `src/features/telemetry/*`
- Create: `src/features/notifications/*`
- Create: `src/lib/live.ts`

**Step 1: Wire placeholder data**
- Add live summaries for energy, climate, appliances, alerts, and context.

**Step 2: Add update transport**
- Use WebSocket or SSE, depending on backend readiness.

**Step 3: Verify**
- Expected: the shell updates without full reloads.

## Phase 3: Make it usable as Mission Control Center

### Task 7: Implement command surfaces and approvals

**Objective:** Add the manager-agent style inbox, approval gates, and action queue.

**Files:**
- Create: `src/features/commands/*`
- Create: `src/features/approvals/*`

**Step 1: Build the command inbox**
- Add queue items, statuses, and ownership.

**Step 2: Add approval states**
- Ask-before-action, blocked, emergency override.

**Step 3: Verify**
- Expected: actions are clearly gated before execution.

### Task 8: Add chat, voice, and gesture entry points

**Objective:** Restore the human input surface across chat, voice, and touch gestures.

**Files:**
- Create: `src/features/chat/*`
- Create: `src/features/voice/*`
- Create: `src/features/gestures/*`

**Step 1: Define entry states**
- Hold-to-speak, text chat, quick actions, touch shortcuts.

**Step 2: Implement visible controls**
- Keep them anchored and obvious.

**Step 3: Verify**
- Expected: the UI supports hands-free and touch-first use.

### Task 9: Add the integration registry and household inventory

**Objective:** Surface connected systems, devices, and permissions in a durable registry.

**Files:**
- Create: `src/features/integrations/*`
- Create: `src/features/devices/*`
- Create: `src/features/permissions/*`

**Step 1: Create registry models**
- Home Assistant, Tailscale, solar PV, AC, hot pool, music, EV charger, hot water, appliances.

**Step 2: Render the registry UI**
- Show state, scope, and last heartbeat.

**Step 3: Verify**
- Expected: the user can see what is connected and what is still stubbed.

### Task 10: Package for desktop and mobile

**Objective:** Prove the React stack can escape the browser without falling apart.

**Files:**
- Create: `tauri.conf.json` or equivalent desktop wrapper config
- Create: mobile wrapper/config if selected
- Create: `docs/deployment.md`

**Step 1: Pick the packaging route**
- Tauri for desktop first.

**Step 2: Verify browser parity**
- Ensure the same UI runs in the browser before wrapping it.

**Step 3: Expand to mobile**
- Only once the shell and visual language are stable.

---

## Acceptance Criteria

- The app feels like a **spatial command surface**, not a generic dashboard.
- The UI supports **semi-transparent layered panels** and **3D-like asset previews**.
- The shell is **fluid and multi-screen aware**, with drag/move behavior instead of scroll-down page navigation as the primary model.
- Jarvis can surface requested content immediately in the workspace rather than burying it behind menus.
- The stack remains **React + TypeScript** as the single source of truth for the UI.
- Browser access works first, then desktop and mobile packaging follow.
- Role-aware navigation, command gates, chat, voice, notifications, and integration registry are visible.

## Verdict Target

- **VALIDATED** if the stress-test screen and asset preview lane deliver the requested look and performance.
- **PARTIAL** if React handles the shell but the 3D preview lane needs special treatment.
- **INVALIDATED** if the experience cannot be made to look and feel materially different from a standard dashboard without unacceptable complexity.
