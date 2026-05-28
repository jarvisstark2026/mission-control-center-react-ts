# Mission Control Release Status

## Current State

Mission Control is release-candidate ready for the local desktop shell, objective-first widget layer, local evidence loop, Hermes/OpenClaw bridge setup, and Command Inbox approval model.

## Finished App-Side Capabilities

- Windows desktop build and NSIS installer.
- Objective-first widgets with local persistence and evidence attachment.
- Goals, Workflow, Agent Console, Agent Control, Command Inbox, JSON Surface, App Portal, and productivity/media widgets.
- Bundled local Mission Control bridge at `http://127.0.0.1:8787`.
- Hermes/OpenClaw connection modes: Same PC, LAN PC, Tailscale.
- HTTP/HTTPS Hermes API support with bearer key support.
- Desktop secret adapter for Hermes API key storage.
- Command Inbox as the execution gate for agent, workflow, native-app, and home-system proposals.
- Local dry-run, backend command gateway, and allowlisted command gateway modes.
- Home Systems backend contract.

## Remaining External Validation

- Live Hermes/OpenClaw task-loop validation against the user's real agent endpoint.
- Live Home Systems backend validation if a backend is connected.
- Hands-on native desktop interaction QA for drag/resize, fullscreen, extension windows, menus, and footer tracker.

## Release Command

```powershell
npm run release:verify
```

This runs the full automated gate set with the bundled Node runtime first in `PATH`, builds the desktop installer, and performs a process-level desktop smoke check.
