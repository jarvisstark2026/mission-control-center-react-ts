# Mission Control Agent Bridge Contract

Mission Control connects to Hermes, OpenClaw, or a custom agent through a small HTTP + SSE bridge. The bridge can propose actions, send status, and emit events, but it must not execute actions directly. Mission Control routes executable work through Command Inbox.

## Base URL

Local default:

```text
http://127.0.0.1:8787
```

LAN example:

```text
http://192.168.x.x:8787
```

## `GET /status`

Returns connector health and the visible agent/runtime state.

```json
{
  "status": "connected",
  "provider": "hermes",
  "activeEngine": "Hermes local bridge",
  "activeAgentId": "hermes-coordinator",
  "currentTask": "Ready to convert Mission Control goals into gated command proposals.",
  "capabilities": ["status", "events", "tasks", "mission-control-events", "json-surface"],
  "lastSeenAt": "2026-05-25T12:00:00.000Z",
  "agents": [
    {
      "id": "hermes-coordinator",
      "name": "Hermes Coordinator",
      "specialty": "coordinator",
      "provider": "hermes",
      "model": "hermes-local",
      "profile": "home-operator",
      "status": "available",
      "connection": "online",
      "summary": "Stages Mission Control proposals for approval.",
      "visibleTo": ["admin", "support", "home"]
    }
  ],
  "jobs": [],
  "permissions": [],
  "usage": {
    "requestCount": 0,
    "approvedActionCount": 0,
    "rejectedActionCount": 0,
    "blockedActionCount": 0,
    "estimatedTokens": 0,
    "estimatedCostUsd": 0,
    "windowStartedAt": "2026-05-25T12:00:00.000Z"
  },
  "activity": []
}
```

Allowed providers are `hermes`, `openclaw`, `openai`, and `custom`. Preferred connector statuses are `connected`, `available`, `offline`, `error`, and `not-configured`. Mission Control also accepts `ok` as a compatibility alias for `connected`.

Mission Control roles are `admin`, `support`, and `home` for visible agent records. Bridge payloads may send `member` as a compatibility alias for `home`; unsupported `guest` visibility is dropped from Agent Control records because Mission Control guests cannot access Agent Control.

## `GET /events`

Opens a Server-Sent Events stream. Each event is sent as JSON in a standard `data:` line.

Status event:

```json
{
  "type": "status",
  "status": {
    "status": "connected",
    "provider": "hermes",
    "activeEngine": "Hermes local bridge"
  }
}
```

Activity event:

```json
{
  "type": "activity",
  "activity": [
    {
      "id": "activity-1",
      "kind": "connection",
      "title": "Heartbeat",
      "detail": "Hermes bridge is online.",
      "timestamp": "2026-05-25T12:00:00.000Z",
      "source": "hermes-bridge",
      "status": "active",
      "visibleTo": ["admin", "support", "home"]
    }
  ]
}
```

Mission event:

```json
{
  "type": "mission-events",
  "events": [
    {
      "type": "notification",
      "notification": {
        "id": "bridge-notification-1",
        "level": "notice",
        "title": "Agent proposal ready",
        "body": "Command Inbox is holding a new proposal.",
        "source": "agent-bridge:hermes",
        "timestamp": "2026-05-25T12:00:00.000Z",
        "acknowledged": false
      }
    }
  ]
}
```

Invalid SSE payloads are rejected into Agent Control diagnostics and do not enter app state.

## `POST /tasks`

Accepts an `AgentTaskRequest` from Agent Console.

```json
{
  "id": "agent-task-123",
  "objective": "Review current mission state and propose the next useful action.",
  "scope": "system",
  "risk": "elevated",
  "role": "admin",
  "targetAgentId": "hermes-coordinator",
  "goalId": "goal-123",
  "evidenceIds": ["evidence-1"],
  "requestedAt": "2026-05-25T12:00:00.000Z"
}
```

Returns an `AgentTaskGatewayResult`. Any executable action must be represented as a pending `command` mission event.

```json
{
  "message": {
    "id": "message-task-123",
    "author": "agent",
    "body": "Hermes staged a pending command proposal. Review it in Command Inbox.",
    "timestamp": "2026-05-25T12:00:01.000Z"
  },
  "proposals": [
    {
      "id": "proposal-command-123",
      "commandId": "command-123",
      "title": "Review mission state",
      "reasoning": "The coordinator mapped the objective to a gated system proposal.",
      "risk": "elevated",
      "scope": "system",
      "agentId": "hermes-coordinator",
      "agentName": "Hermes Coordinator",
      "timestamp": "2026-05-25T12:00:01.000Z"
    }
  ],
  "missionControlEvents": [
    {
      "type": "command",
      "command": {
        "id": "command-123",
        "title": "Review mission state",
        "summary": "Review current mission state and propose the next useful action.",
        "source": "agent-bridge:hermes",
        "goalId": "goal-123",
        "evidenceIds": ["evidence-1"],
        "agent": {
          "agentId": "hermes-coordinator",
          "agentName": "Hermes Coordinator",
          "profile": "home-operator"
        },
        "reasoning": "Hermes produced this proposal from POST /tasks.",
        "expectedResult": "Mission Control stores the command as pending and waits for approval.",
        "scope": "system",
        "risk": "elevated",
        "status": "pending",
        "requestedAt": "2026-05-25T12:00:01.000Z",
        "execution": {
          "status": "not-started",
          "result": "Waiting in Command Inbox for human approval.",
          "rollbackAvailable": false
        },
        "auditTrail": [
          {
            "id": "audit-command-123-proposed",
            "type": "proposed",
            "actor": "hermes-bridge",
            "timestamp": "2026-05-25T12:00:01.000Z",
            "detail": "Hermes proposed a gated command."
          }
        ]
      }
    }
  ]
}
```

## `POST /emit`

Development helper for sending `MissionControlEvent[]` into Mission Control through SSE.

```json
{
  "events": [
    {
      "type": "notification",
      "notification": {
        "id": "manual-bridge-test",
        "level": "notice",
        "title": "Manual bridge test",
        "body": "This notification came from POST /emit.",
        "source": "agent-bridge:test",
        "timestamp": "2026-05-25T12:00:00.000Z",
        "acknowledged": false
      }
    }
  ]
}
```

## Safety Rules

- The bridge can suggest, explain, and stream evidence.
- The bridge cannot execute Mission Control actions directly.
- Commands must enter Command Inbox as `pending`.
- Mission Control validates bridge payloads before mutating app state.
- Invalid payloads appear in Agent Control diagnostics.
