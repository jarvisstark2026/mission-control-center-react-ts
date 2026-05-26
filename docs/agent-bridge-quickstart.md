# Mission Control Agent Bridge Quickstart

Use this when you want an installed Hermes, OpenClaw, or compatible agent to appear inside Mission Control and send proposals to Command Inbox.

## The Simple Model

Mission Control desktop always talks to its own local bridge:

```text
http://127.0.0.1:8787
```

The local bridge then connects to Hermes through one of three modes:

| Mode | Hermes API base URL |
| --- | --- |
| Same PC | `http://127.0.0.1:<port>/v1` |
| LAN PC | `http://<lan-host-or-ip>:<port>/v1` |
| Tailscale | `http://<tailscale-host-or-ip>:<port>/v1` |

Browser preview can edit settings and test the loop, but it cannot start or stop the bundled local bridge. Use the Windows desktop app for the normal user setup.

## What Must Work First

Hermes must expose an OpenAI-compatible API:

```text
GET  /v1/models
POST /v1/chat/completions
```

For LAN or Tailscale access, configure Hermes with a bearer key:

```text
API_SERVER_ENABLED=true
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=8642
API_SERVER_KEY=<user-secret>
API_SERVER_MODEL_NAME=hermes-agent
```

Start Hermes with:

```powershell
hermes gateway
```

Typical Hermes URL on the Hermes machine:

```text
http://127.0.0.1:8642/v1
```

The default port is `8642`. Change the port in Agent Control if Hermes is listening on another HTTP port such as `80`, `8445`, or `8446`.

For another PC, verify from the Mission Control PC:

```powershell
Invoke-RestMethod http://192.0.2.64:8642/v1/models
Invoke-RestMethod http://198.51.100.119:8642/v1/models
```

If `API_SERVER_KEY` is set, include the bearer token:

```powershell
Invoke-RestMethod http://192.0.2.64:8642/v1/models -Headers @{ Authorization = "Bearer <user-secret>" }
```

Use the LAN address if it works. Use Tailscale if LAN routing or firewall rules are harder.

## Mission Control Steps

1. Open `Agent Control`.
2. Open `Bridge setup`.
3. Choose `Same PC`, `LAN PC`, or `Tailscale`.
4. For LAN/Tailscale, enter only the host or IP, for example `192.0.2.64` or `198.51.100.119`.
5. Set `Hermes API port`; keep `8642` unless Hermes is listening elsewhere.
6. Paste the `Hermes API key` if Hermes requires bearer auth.
7. Click `Save settings`.
8. Click `Start bridge`.
9. Click `Test Hermes API`.
10. Click `Send test proposal`.
11. Review the pending proposal in `Command Inbox`.

The bundled Mission Control bridge currently supports HTTP Hermes API endpoints. HTTPS support is a separate bridge enhancement.

## Safety Rule

The bridge can send status, events, and pending command proposals. It must not execute actions directly. Mission Control keeps execution gated through Command Inbox.

## Developer Harness

The repo still includes Node harness scripts for development and contract testing. End users should not need the repo or those scripts once Mission Control is installed.
