# Desktop Release Candidate QA

Use this checklist for every Windows desktop release candidate. Run the installed app or release executable, not the Vite dev server.

## Build Outputs

- Release executable: `src-tauri/target/release/mission-control-center.exe`
- NSIS installer: `src-tauri/target/release/bundle/nsis/Mission Control_0.1.0_x64-setup.exe`

## Build Checklist

- [ ] `npm run release:verify`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test:run`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] `npm run desktop:build`

## Desktop Runtime Checklist

- [ ] Launch the installed app with no Vite/dev server running.
- [ ] Confirm the main window is visible and focused.
- [ ] Open at least one extension workspace and confirm it opens as a separate native window.
- [ ] Confirm extension close moves it to saved/restorable state instead of deleting its memory.
- [ ] Confirm widgets cannot transfer into closed/SAVED workspaces from workspace borders.
- [ ] Save layout in the main workspace, close/reopen the app, and verify the layout returns.
- [ ] Save a different active mode/layout in an extension workspace, close/reopen, and verify it returns.
- [ ] Test current-window fullscreen from the top bar.
- [ ] Test all-ON-workspaces fullscreen from the top bar.

## Responsiveness Checklist

- [ ] Open 10-15 widgets from Open Widget and App Launcher.
- [ ] Drag several open widgets; movement should start immediately and follow the pointer.
- [ ] Resize widgets from right, bottom, corner, and top border; resize should follow the pointer.
- [ ] Open and close Mode Preset, Theme, Permissions, Access, and Open Widget menus; each should respond immediately.
- [ ] Use the footer tracker to focus, pin, and close widgets; right-click actions should open without lag.
- [ ] Open Manager and confirm it reflects only ON workspace windows.

## Release Acceptance

- [ ] Installer branding shows Mission Control and the current app icon.
- [ ] Installed app opens without requiring the repo, Vite, or a terminal.
- [ ] Browser preview still works through `.\tools\run-browser-dev.ps1` or `npm run dev`.
- [ ] Agent Control can start the local bridge from the desktop app, save a Hermes key, test `/status`, and send a proposal to Command Inbox.
- [ ] Native App web/protocol launch requests stage Command Inbox proposals instead of launching directly.
- [ ] Home Systems shows local baseline/offline/live source truth and stages device actions only as proposals.
- [ ] `.codex/environments/environment.toml` remains uncommitted unless intentionally changing the Codex dev environment.
- [ ] No unrelated files, including `shopify-theme/`, are staged in the release commit.
