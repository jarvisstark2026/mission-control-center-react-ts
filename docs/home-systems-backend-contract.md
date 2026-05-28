# Mission Control Home Systems Backend Contract

Mission Control can render Home Systems from a local baseline or from a configured HTTP backend. Set `VITE_HOME_SYSTEMS_API_URL` to a JSON endpoint. The widget never executes device actions directly; every control action becomes a pending Command Inbox proposal.

## Endpoint

```http
GET /home-systems
Accept: application/json
```

The endpoint may be local-network only. Mission Control treats failed requests as `offline` and keeps the local baseline visible.

## Response Shape

```json
{
  "updatedAt": "2026-05-28T12:00:00.000Z",
  "snapshot": {
    "generationKw": 5.1,
    "consumptionKw": 2.5,
    "batteryPercent": 72,
    "evRangeKm": 180
  },
  "dailyProfile": [
    { "hour": 12, "solarPvKw": 5.1, "homeLoadKw": 2.5, "batteryKw": 1.2, "evKw": 0, "gridKw": -1.4 }
  ],
  "records": [
    {
      "id": "kitchen-ac",
      "name": "Kitchen AC",
      "category": "climate",
      "zone": "Kitchen",
      "status": "online",
      "capability": "read",
      "metric": "22 C",
      "detail": "Cooling normally"
    }
  ]
}
```

Partial payloads are accepted and merged with the local baseline so the widget remains usable.

## Safety

- Device actions are proposal-only.
- Command Inbox is the only approval and execution gate.
- A real executor must register allowlisted actions before external devices can change state.
