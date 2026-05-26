# Mission Control Agent Bridge Harness

The bridge harness is a local development server for testing the Hermes/OpenClaw integration before the real agent PC is connected. It implements the Mission Control bridge contract with built-in Node modules only.

## Run Locally

Use a Node version compatible with the app, then start the harness:

```powershell
npm run agent:bridge
```

Default endpoint:

```text
http://127.0.0.1:8787
```

Configure a different host, port, or provider:

```powershell
$env:AGENT_BRIDGE_HOST = "0.0.0.0"
$env:AGENT_BRIDGE_PORT = "8787"
$env:AGENT_BRIDGE_PROVIDER = "hermes"
npm run agent:bridge
```

Allowed providers are `hermes`, `openclaw`, and `custom`.

## Use From Mission Control Browser Preview

The harness is for development and browser-preview contract testing. Installed Mission Control users should use Agent Control's three modes instead.

1. Start the harness at `http://127.0.0.1:8787`.
2. Open Mission Control browser preview.
3. Open `Agent Control`.
4. Click `Probe now`.
5. Agent Control should show the local Hermes/OpenClaw connector as connected after the next probe.
6. Open `Agent Console`, submit a task, then review the generated proposal in `Command Inbox`.

## LAN Harness Test

For development only, the harness can expose the bridge contract on the LAN:

```text
http://192.168.x.x:8787
```

Windows Firewall may require allowing inbound TCP traffic for the selected port on the harness PC.

For a LAN test with the harness:

```powershell
npm run agent:bridge:lan
```

Then connect Mission Control from another machine to:

```text
http://<bridge-pc-lan-ip>:8787
```

To create the Windows Firewall rule at the same time, run PowerShell as administrator on the Hermes/OpenClaw PC:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/start-agent-bridge.ps1 -BindHost 0.0.0.0 -Port 8787 -Provider hermes -OpenFirewall
```

To verify local, LAN, and Tailscale harness endpoints from the Mission Control PC:

```powershell
npm run agent:bridge:verify
```

For a real installed-app Hermes setup, prefer the built-in Agent Control modes instead:

```text
Same PC:   http://127.0.0.1:8642/v1
LAN PC:    http://192.0.2.64:8642/v1
Tailscale: http://198.51.100.119:8642/v1
```

## Endpoints

- `GET /status`: connector status, provider, agents, jobs, permissions, usage, activity, capabilities.
- `GET /events`: SSE stream for status, activity, and mission events.
- `POST /tasks`: accepts an Agent Console task and returns a pending Command Inbox proposal.
- `POST /emit`: broadcasts valid mission events to connected Mission Control clients.
- `GET /sample-json`: sample payload for JSON Surface testing.

Example notification emit:

```powershell
$body = @{
  events = @(
    @{
      type = "notification"
      notification = @{
        id = "manual-bridge-test"
        level = "notice"
        title = "Manual bridge test"
        body = "This notification came from POST /emit."
        source = "agent-bridge:test"
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        acknowledged = $false
      }
    }
  )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://127.0.0.1:8787/emit" -Method Post -Body $body -ContentType "application/json"
```

## Safety Boundary

The harness does not execute commands. It only creates pending command proposals and notifications. Mission Control Command Inbox remains the only approval and execution gate.
