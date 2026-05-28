# Desktop RC Runtime QA - 2026-05-28

## Automated Checks

- Full gate set passed with bundled Node `v24.14.0` first in `PATH`:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
  - `npm run test:e2e`
  - `npm run desktop:build`
- Release executable exists: `src-tauri/target/release/mission-control-center.exe`
- NSIS installer exists: `src-tauri/target/release/bundle/nsis/Mission Control_0.1.0_x64-setup.exe`
- Release executable launched and the `mission-control-center` process stayed alive during an 8 second smoke window.

## Release-Blocking Feature Checks

- Agent bridge supports HTTP and HTTPS Hermes API endpoints through the bundled local bridge.
- Hermes API key can be stored through the desktop secret adapter; browser preview remains local-settings only.
- Command Inbox still gates every executable action.
- Native App launch requests are staged as Command Inbox proposals; arbitrary executable paths remain blocked.
- Home Systems has a documented backend contract and remains proposal-only for device actions.

## Manual Checks Still Required

The shell smoke confirms the packaged executable starts. These interactive checks still need hands-on confirmation in the visible installed Windows app:

- Main window is visibly focused and usable.
- Extension workspaces open as separate native windows.
- Closing an extension marks it `SAVED`, not deleted.
- Widgets cannot transfer into closed/SAVED workspace borders.
- Save/reset layout and active mode persist after close/reopen.
- Fullscreen current window and all ON workspaces work.
- 10-15 open widgets still drag/resize immediately.
- Top menus, footer tracker, Manager, Open Widget, Mode Preset, and Permissions respond without lag.
- Agent Control can start the local bridge, save a Hermes key, test `/status`, send a proposal, and route it through Command Inbox.
