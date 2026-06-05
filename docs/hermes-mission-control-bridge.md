# Hermes Bridge For Installed Mission Control

The Windows desktop app includes a local Mission Control bridge. Users do not need the app repo on the Hermes PC.

## Runtime Shape

Mission Control UI -> local bridge on the Mission Control PC:

```text
http://127.0.0.1:8787
```

Local bridge -> Hermes/OpenClaw API:

```text
http(s)://<selected-host>:<port>/v1
```

The selected host comes from one of three Agent Control modes:

- `Same PC`: `127.0.0.1`
- `LAN PC`: a local network host/IP such as `<lan-host-or-ip>`
- `Tailscale`: a Tailscale host/IP such as `<tailscale-host-or-ip>`

The selected port defaults to `8642`, but Agent Control can point at another port if Hermes is configured differently. HTTPS endpoints are supported with normal certificate validation; invalid or self-signed certificates fail closed.

## Local Defaults

Mission Control can seed Agent Control from local Vite env defaults when no saved Agent Control settings exist. Keep these values non-secret:

```env
VITE_HERMES_BRIDGE_MODE=tailscale
VITE_HERMES_HOST=<tailscale-host-or-ip>
VITE_HERMES_API_PORT=8642
VITE_HERMES_API_SCHEME=http
VITE_HERMES_MODEL=hermes-agent
VITE_AGENT_LOCAL_BRIDGE_URL=http://127.0.0.1:8787
```

Put machine-specific values in `.env.local`, which stays uncommitted. Do not put `API_SERVER_KEY` or voice transcription bearer keys in env files; paste and save those through Agent Control so the desktop credential adapter can protect them. Voice transcription URL/model defaults can be added later with the same non-secret pattern, while the voice key stays in credential storage.

For public installers or public CI builds, build without a machine-specific `.env.local`; Vite can inline `VITE_*` values into generated app assets even though the file itself is ignored by Git.

## Hermes Requirement

Hermes should expose an OpenAI-compatible API:

```text
GET  /v1/models
POST /v1/chat/completions
```

For LAN or Tailscale access, enable the Hermes API server and set a bearer token:

```text
API_SERVER_ENABLED=true
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=8642
API_SERVER_KEY=<user-secret>
API_SERVER_MODEL_NAME=hermes-agent
```

The Mission Control bridge checks `/models`, forwards tasks to `/chat/completions`, and converts the response into pending Mission Control command proposals.

## Agent Control Verification

1. Choose the mode.
2. Enter the host if using LAN or Tailscale.
3. Set the scheme/port and paste the API key if Hermes requires bearer auth.
4. Click `Save settings`.
5. Click `Start bridge`.
6. Click `Test Hermes API`.
7. Click `Send test proposal`.

Success means `Command Inbox` receives a pending proposal. Nothing executes directly.

## Developer Scripts

The repo also contains Node bridge scripts for development:

- `tools/hermes-mission-control-bridge.mjs`
- `tools/start-hermes-mission-control-bridge.ps1`

These are useful for contract testing, but the installed app path should use the bundled desktop bridge.
