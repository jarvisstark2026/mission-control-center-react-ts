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
| Same PC | `http://127.0.0.1:8642/v1` |
| LAN PC | `http://<lan-host-or-ip>:8642/v1` |
| Tailscale | `http://<tailscale-host-or-ip>:8642/v1` |

Browser preview can edit settings and test the loop, but it cannot start or stop the bundled local bridge. Use the Windows desktop app for the normal user setup.

## What Must Work First

Hermes must expose an OpenAI-compatible API:

```text
GET  /v1/models
POST /v1/chat/completions
```

Typical Hermes URL on the Hermes machine:

```text
http://127.0.0.1:8642/v1
```

For another PC, verify from the Mission Control PC:

```powershell
Invoke-RestMethod http://192.0.2.64:8642/v1/models
Invoke-RestMethod http://198.51.100.119:8642/v1/models
```

Use the LAN address if it works. Use Tailscale if LAN routing or firewall rules are harder.

## Mission Control Steps

1. Open `Agent Control`.
2. Open `Bridge setup`.
3. Choose `Same PC`, `LAN PC`, or `Tailscale`.
4. For LAN/Tailscale, enter only the host or IP, for example `192.0.2.64` or `198.51.100.119`.
5. Click `Save settings`.
6. Click `Start bridge`.
7. Click `Test Hermes API`.
8. Click `Send test proposal`.
9. Review the pending proposal in `Command Inbox`.

## Safety Rule

The bridge can send status, events, and pending command proposals. It must not execute actions directly. Mission Control keeps execution gated through Command Inbox.

## Developer Harness

The repo still includes Node harness scripts for development and contract testing. End users should not need the repo or those scripts once Mission Control is installed.
