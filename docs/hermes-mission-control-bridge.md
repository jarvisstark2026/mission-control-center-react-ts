# Hermes Bridge For Installed Mission Control

The Windows desktop app includes a local Mission Control bridge. Users do not need the app repo on the Hermes PC.

## Runtime Shape

Mission Control UI -> local bridge on the Mission Control PC:

```text
http://127.0.0.1:8787
```

Local bridge -> Hermes/OpenClaw API:

```text
http://<selected-host>:<port>/v1
```

The selected host comes from one of three Agent Control modes:

- `Same PC`: `127.0.0.1`
- `LAN PC`: a local network host/IP such as `192.0.2.64`
- `Tailscale`: a Tailscale host/IP such as `198.51.100.119`

The selected port defaults to `8642`, but Agent Control can point at another HTTP port if Hermes is configured differently.

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
3. Set the port and paste the API key if Hermes requires bearer auth.
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
