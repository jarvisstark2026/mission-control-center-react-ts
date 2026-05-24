# Desktop RC Runtime QA - 2026-05-24

Baseline commit: `1192b35`

## Automated Checks

- Release executable exists: `src-tauri/target/release/mission-control-center.exe`
- NSIS installer exists: `src-tauri/target/release/bundle/nsis/Mission Control Center_0.1.0_x64-setup.exe`
- No Vite preview/dev server was listening on port `5173` during desktop launch checks.
- Release executable launched and the `mission-control-center` process was responding.
- NSIS installer ran successfully and created:
  - Installed executable: `%LOCALAPPDATA%\Mission Control Center\mission-control-center.exe`
  - Start Menu shortcut: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Mission Control Center.lnk`
- Installed executable launched from `%LOCALAPPDATA%` and the process was responding.
- Desktop app-data persistence file exists at `%APPDATA%\com.jarvisstark.mission-control-center\mission-control-state.json`.
- Existing app-data state contains workspace/layout/theme/widget-local keys, including workspace layout and theme state.

## Manual Checks Still Required

The Codex shell can launch the native app and inspect process/install state, but it cannot reliably drive or verify interactive native-window gestures. These checks still need hands-on confirmation in the installed Windows app:

- Main window is visibly focused and usable.
- Extension workspaces open as separate native windows.
- Closing an extension marks it `SAVED`, not deleted.
- Widgets cannot transfer into closed/SAVED workspace borders.
- Save/reset layout and active mode persist after close/reopen.
- Fullscreen current window and all ON workspaces work.
- 10-15 open widgets still drag/resize immediately.
- Top menus, footer tracker, Manager, Open Widget, Mode Preset, and Permissions respond without lag.

## Issue Log

- `Follow-up`: Native interactive RC checklist still needs manual validation in the visible installed app.
- No automated `Blocker`, `Performance`, or `Polish` issue was found in this pass.

