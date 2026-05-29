import http from 'node:http';
import { URL } from 'node:url';

const host = process.env.AGENT_BRIDGE_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.AGENT_BRIDGE_PORT || '8787', 10);
const providerInput = (process.env.AGENT_BRIDGE_PROVIDER || 'hermes').toLowerCase();
const provider = ['hermes', 'openclaw', 'custom'].includes(providerInput) ? providerInput : 'hermes';
const clients = new Set();

function nowIso() {
  return new Date().toISOString();
}

function createAgentName() {
  if (provider === 'openclaw') return 'OpenClaw Coordinator';
  if (provider === 'custom') return 'Custom Agent Bridge';
  return 'Hermes Coordinator';
}

function createBridgeStatus() {
  const timestamp = nowIso();
  const agentName = createAgentName();

  return {
    status: 'connected',
    provider,
    activeEngine: provider === 'openclaw' ? 'OpenClaw local bridge' : provider === 'custom' ? 'Custom local bridge' : 'Hermes local bridge',
    activeAgentId: `${provider}-coordinator`,
    currentTask: 'Ready to convert Mission Control goals into gated command proposals.',
    capabilities: ['status', 'events', 'tasks', 'workspace-layout-control', 'mission-control-events', 'json-surface'],
    lastSeenAt: timestamp,
    agents: [
      {
        id: `${provider}-coordinator`,
        name: agentName,
        specialty: 'coordinator',
        provider,
        model: 'local-bridge-harness',
        profile: 'home-operator',
        status: 'available',
        connection: 'online',
        summary: 'Receives Mission Control tasks and stages pending command proposals for Command Inbox.',
        visibleTo: ['admin', 'support', 'home'],
      },
      {
        id: `${provider}-support`,
        name: provider === 'openclaw' ? 'OpenClaw Support' : 'Hermes Support',
        specialty: 'support',
        provider,
        model: 'local-bridge-harness',
        profile: 'support-diagnostics',
        status: 'available',
        connection: 'online',
        summary: 'Creates diagnostics and evidence-first support proposals.',
        visibleTo: ['admin', 'support'],
      },
    ],
    jobs: [
      {
        id: `${provider}-heartbeat-monitor`,
        name: 'Bridge heartbeat monitor',
        kind: 'monitor',
        status: 'active',
        cadence: 'Every 15 seconds',
        lastRunAt: timestamp,
        nextRunAt: new Date(Date.now() + 15_000).toISOString(),
        owner: agentName,
        safeForHome: true,
        description: 'Emits agent bridge status and activity events to Mission Control.',
        visibleTo: ['admin', 'support', 'home'],
      },
    ],
    permissions: [
      {
        id: `${provider}-perm-propose`,
        label: 'Propose command actions',
        category: 'commands',
        level: 'suggest',
        risk: 'medium',
        description: 'Can create pending Command Inbox proposals, but cannot execute directly.',
        visibleTo: ['admin', 'support', 'home'],
      },
      {
        id: `${provider}-perm-workspace-read`,
        label: 'Read Mission Control task context',
        category: 'workspace',
        level: 'read',
        risk: 'low',
        description: 'Reads task objectives, goal IDs, and evidence IDs sent by Mission Control.',
        visibleTo: ['admin', 'support', 'home'],
      },
    ],
    usage: {
      requestCount: 0,
      approvedActionCount: 0,
      rejectedActionCount: 0,
      blockedActionCount: 0,
      estimatedTokens: 0,
      estimatedCostUsd: 0,
      windowStartedAt: timestamp,
    },
    activity: [
      {
        id: `${provider}-activity-ready`,
        kind: 'connection',
        title: 'Bridge harness online',
        detail: `${agentName} is ready at http://${host}:${port}.`,
        timestamp,
        source: 'agent-bridge-harness',
        status: 'active',
        visibleTo: ['admin', 'support', 'home'],
      },
    ],
  };
}

function createTaskResult(request) {
  const timestamp = nowIso();
  const objective = typeof request.objective === 'string' && request.objective.trim() ? request.objective.trim() : 'Review Mission Control task';
  const title = objective.length > 58 ? `${objective.slice(0, 55).trim()}...` : objective;
  const safeScope = ['household', 'system', 'support', 'security'].includes(request.scope) ? request.scope : 'system';
  const safeRisk = ['safe', 'elevated', 'critical'].includes(request.risk) ? request.risk : 'safe';
  const agentId = typeof request.targetAgentId === 'string' && request.targetAgentId ? request.targetAgentId : `${provider}-coordinator`;
  const agentName = createAgentName();
  const commandId = `bridge-task-${request.id || Date.now().toString(36)}`;
  const profile = safeScope === 'support' ? 'support-diagnostics' : safeScope === 'security' ? 'security-watch' : 'home-operator';

  return {
    message: {
      id: `message-${commandId}`,
      author: 'agent',
      body: `${agentName} staged "${title}" as a pending Mission Control command proposal. Review it in Command Inbox before execution.`,
      timestamp,
    },
    proposals: [
      {
        id: `proposal-${commandId}`,
        commandId,
        title,
        reasoning: `${agentName} mapped the task objective to a gated ${safeScope} proposal and preserved the Mission Control approval boundary.`,
        risk: safeRisk,
        scope: safeScope,
        agentId,
        agentName,
        timestamp,
      },
    ],
    missionControlEvents: [
      {
        type: 'command',
        command: {
          id: commandId,
          title,
          summary: objective,
          source: `agent-bridge:${provider}`,
          goalId: typeof request.goalId === 'string' ? request.goalId : undefined,
          evidenceIds: Array.isArray(request.evidenceIds) ? request.evidenceIds.filter((item) => typeof item === 'string') : [],
          agent: {
            agentId,
            agentName,
            profile,
          },
          reasoning: `${agentName} produced this proposal from POST /tasks. The harness cannot execute it directly.`,
          expectedResult: 'Mission Control stores the command as pending and waits for an allowed role to approve, reject, block, or override.',
          scope: safeScope,
          risk: safeRisk,
          status: 'pending',
          requestedAt: timestamp,
          execution: {
            status: 'not-started',
            result: 'Waiting in Command Inbox for human approval.',
            rollbackAvailable: safeRisk === 'safe',
          },
          auditTrail: [
            {
              id: `audit-${commandId}-proposed`,
              type: 'proposed',
              actor: 'agent-bridge-harness',
              timestamp,
              detail: `${agentName} proposed "${title}" through the Mission Control bridge contract.`,
            },
          ],
        },
      },
      {
        type: 'notification',
        notification: {
          id: `notification-${commandId}`,
          level: safeRisk === 'critical' ? 'critical' : safeRisk === 'elevated' ? 'warning' : 'notice',
          title: 'Agent proposal ready',
          body: `Command Inbox is holding "${title}" from ${agentName}.`,
          source: `agent-bridge:${provider}`,
          timestamp,
          acknowledged: false,
          relatedCommandId: commandId,
        },
      },
    ],
  };
}

function createLayoutPlan(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || typeof snapshot.workspaceId !== 'string' || !Array.isArray(snapshot.widgets)) {
    throw new Error('Invalid workspace layout snapshot.');
  }
  const movableWidgets = snapshot.widgets.filter((widget) => widget && !widget.hidden && !widget.pinned);
  const firstWidget = movableWidgets[0];
  if (!firstWidget) {
    return { directives: [], provider, generatedAt: nowIso() };
  }

  const width = Math.max(firstWidget.minWidth || 320, Math.min(firstWidget.width || 390, Math.floor((snapshot.canvas?.width || 900) * 0.48)));
  const height = Math.max(firstWidget.minHeight || 240, Math.min(firstWidget.height || 360, Math.floor((snapshot.canvas?.height || 700) * 0.52)));
  return {
    directives: [
      {
        id: `harness-layout-${Date.now().toString(36)}`,
        workspaceId: snapshot.workspaceId,
        widgetId: firstWidget.id,
        action: 'move-resize',
        target: {
          x: 18,
          y: 72,
          width,
          height,
        },
        durationMs: 520,
        easing: 'ease-out',
        reason: 'Harness live layout smoke movement.',
      },
    ],
    provider,
    generatedAt: nowIso(),
  };
}

function createSampleJson() {
  return {
    title: 'Bridge system snapshot',
    source: 'agent-bridge-harness',
    schemaHint: 'metrics',
    payload: {
      provider,
      endpoint: `http://${host}:${port}`,
      status: 'connected',
      commandGate: 'Command Inbox required',
      eventStream: 'SSE /events',
      generatedAt: nowIso(),
    },
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,accept',
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error('Request body too large.'));
      }
    });
    request.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function writeSse(response, payload) {
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(payload) {
  for (const client of clients) {
    writeSse(client, payload);
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === 'GET' && url.pathname === '/status') {
    sendJson(response, 200, createBridgeStatus());
    return;
  }

  if (request.method === 'GET' && url.pathname === '/sample-json') {
    sendJson(response, 200, createSampleJson());
    return;
  }

  if (request.method === 'GET' && url.pathname === '/events') {
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    });
    clients.add(response);
    writeSse(response, { type: 'status', status: createBridgeStatus() });
    request.on('close', () => {
      clients.delete(response);
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/tasks') {
    try {
      const body = await readJsonBody(request);
      const result = createTaskResult(body);
      broadcast({ type: 'activity', activity: createBridgeStatus().activity });
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid task request.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/workspace/layout/plan') {
    try {
      const body = await readJsonBody(request);
      sendJson(response, 200, createLayoutPlan(body));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid layout snapshot.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/emit') {
    try {
      const body = await readJsonBody(request);
      const record = body && typeof body === 'object' ? body : {};
      const events = Array.isArray(body)
        ? body
        : Array.isArray(record.events)
          ? record.events
          : Array.isArray(record.missionControlEvents)
            ? record.missionControlEvents
            : [];
      const payload = { type: 'mission-events', events };
      broadcast(payload);
      sendJson(response, 200, { sent: events.length });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid emit payload.' });
    }
    return;
  }

  sendJson(response, 404, {
    error: 'Not found',
    endpoints: ['/status', '/events', '/tasks', '/workspace/layout/plan', '/emit', '/sample-json'],
  });
});

server.listen(port, host, () => {
  console.log(`Mission Control agent bridge harness listening at http://${host}:${port}`);
  console.log(`Provider: ${provider}`);
  console.log('Endpoints: GET /status, GET /events, POST /tasks, POST /workspace/layout/plan, POST /emit, GET /sample-json');
});

const heartbeat = setInterval(() => {
  broadcast({
    type: 'activity',
    activity: [
      {
        id: `${provider}-heartbeat-${Date.now().toString(36)}`,
        kind: 'connection',
        title: 'Bridge heartbeat',
        detail: `Harness heartbeat from ${createAgentName()}.`,
        timestamp: nowIso(),
        source: 'agent-bridge-harness',
        status: 'active',
        visibleTo: ['admin', 'support', 'home'],
      },
    ],
  });
}, 15_000);

function shutdown() {
  clearInterval(heartbeat);
  for (const client of clients) {
    client.end();
  }
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
