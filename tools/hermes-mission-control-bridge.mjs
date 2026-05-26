import http from 'node:http';
import { URL } from 'node:url';

const host = process.env.AGENT_BRIDGE_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.AGENT_BRIDGE_PORT || '8787', 10);
const hermesApiBase = (process.env.HERMES_API_BASE_URL || 'http://127.0.0.1:8642/v1').replace(/\/+$/u, '');
const hermesApiKey = process.env.HERMES_API_KEY || 'change-me-local-dev';
const hermesModel = process.env.HERMES_MODEL || 'hermes-agent';
const hermesTimeoutMs = Number.parseInt(process.env.HERMES_TIMEOUT_MS || '120000', 10);
const clients = new Set();
let requestCount = 0;
let windowStartedAt = new Date().toISOString();
let lastHermesStatus = {
  ok: false,
  checkedAt: '',
  detail: 'not checked',
};

function nowIso() {
  return new Date().toISOString();
}

function createHeaders(extra = {}) {
  const headers = {
    accept: 'application/json',
    ...extra,
  };
  if (hermesApiKey) {
    headers.authorization = `Bearer ${hermesApiKey}`;
  }
  return headers;
}

function createSlug(value) {
  return String(value || 'task')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/(^-|-$)/gu, '')
    .slice(0, 32) || 'task';
}

function truncate(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function normalizeScope(value) {
  return ['household', 'system', 'support', 'security'].includes(value) ? value : 'system';
}

function normalizeRisk(value) {
  return ['safe', 'elevated', 'critical'].includes(value) ? value : 'safe';
}

function normalizeRole(value) {
  return ['admin', 'support', 'home', 'guest'].includes(value) ? value : 'admin';
}

function getHealthCandidates() {
  const baseUrl = new URL(hermesApiBase);
  const origin = `${baseUrl.protocol}//${baseUrl.host}`;
  return [
    process.env.HERMES_HEALTH_URL,
    `${origin}/health`,
    `${hermesApiBase}/models`,
  ].filter(Boolean);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = hermesTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkHermes() {
  const checkedAt = nowIso();
  for (const url of getHealthCandidates()) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: createHeaders(),
        },
        5000,
      );
      if (response.ok) {
        lastHermesStatus = {
          ok: true,
          checkedAt,
          detail: `${response.status} ${response.statusText}`.trim(),
        };
        return lastHermesStatus;
      }
      lastHermesStatus = {
        ok: false,
        checkedAt,
        detail: `${url} returned ${response.status}`,
      };
    } catch (error) {
      lastHermesStatus = {
        ok: false,
        checkedAt,
        detail: `${url} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }
  return lastHermesStatus;
}

function createBridgeStatus() {
  const timestamp = nowIso();
  const connected = lastHermesStatus.ok;

  return {
    status: connected ? 'connected' : 'offline',
    provider: 'hermes',
    activeEngine: `Hermes Agent API ${hermesModel}`,
    activeAgentId: 'hermes-coordinator',
    currentTask: connected
      ? 'Connected to Hermes Agent and ready to stage Mission Control proposals.'
      : `Waiting for Hermes API at ${hermesApiBase}. ${lastHermesStatus.detail}`,
    capabilities: ['status', 'events', 'tasks', 'mission-control-events', 'json-surface', 'hermes-chat-completions'],
    lastSeenAt: connected ? timestamp : lastHermesStatus.checkedAt || timestamp,
    agents: [
      {
        id: 'hermes-coordinator',
        name: 'Hermes Coordinator',
        specialty: 'coordinator',
        provider: 'hermes',
        model: hermesModel,
        profile: 'mission-control-operator',
        status: connected ? 'available' : 'offline',
        connection: connected ? 'online' : 'offline',
        summary: 'Receives Mission Control tasks, asks Hermes Agent, and stages pending Command Inbox proposals.',
        visibleTo: ['admin', 'support', 'home'],
      },
    ],
    jobs: [
      {
        id: 'hermes-api-health',
        name: 'Hermes API health',
        kind: 'monitor',
        status: 'active',
        cadence: 'every request / heartbeat',
        lastRunAt: lastHermesStatus.checkedAt || timestamp,
        nextRunAt: new Date(Date.now() + 15_000).toISOString(),
        owner: 'Hermes Coordinator',
        safeForHome: true,
        description: `Checks Hermes Agent API at ${hermesApiBase}.`,
        visibleTo: ['admin', 'support', 'home'],
      },
    ],
    permissions: [
      {
        id: 'hermes-read-context',
        label: 'Read Mission Control task context',
        category: 'workspace',
        level: 'read',
        risk: 'low',
        description: 'Reads task objective, role, risk, goal ID, and evidence IDs sent by Mission Control.',
        visibleTo: ['admin', 'support', 'home'],
      },
      {
        id: 'hermes-stage-proposals',
        label: 'Stage command proposals',
        category: 'commands',
        level: 'suggest',
        risk: 'medium',
        description: 'Can create pending Command Inbox proposals, but cannot execute actions directly.',
        visibleTo: ['admin', 'support', 'home'],
      },
    ],
    usage: {
      requestCount,
      approvedActionCount: 0,
      rejectedActionCount: 0,
      blockedActionCount: 0,
      estimatedTokens: 0,
      estimatedCostUsd: 0,
      windowStartedAt,
    },
    activity: [
      {
        id: 'hermes-bridge-status',
        kind: 'connection',
        title: connected ? 'Hermes API connected' : 'Hermes API offline',
        detail: connected ? `Forwarding Mission Control tasks to ${hermesApiBase}.` : lastHermesStatus.detail,
        timestamp,
        source: 'hermes-mission-control-bridge',
        status: connected ? 'succeeded' : 'failed',
        visibleTo: ['admin', 'support', 'home'],
      },
    ],
  };
}

function createPrompt(request) {
  const objective = typeof request.objective === 'string' ? request.objective.trim() : '';
  const payload = {
    objective,
    scope: normalizeScope(request.scope),
    risk: normalizeRisk(request.risk),
    role: normalizeRole(request.role),
    goalId: typeof request.goalId === 'string' ? request.goalId : null,
    evidenceIds: Array.isArray(request.evidenceIds) ? request.evidenceIds.filter((item) => typeof item === 'string') : [],
  };

  return [
    {
      role: 'system',
      content:
        'You are Hermes connected to Mission Control. Reply with a concise operational proposal only. Do not claim that actions were executed. Mission Control Command Inbox is the only execution gate. Include reasoning, expected result, and any evidence needed.',
    },
    {
      role: 'user',
      content: `Create a Mission Control Command Inbox proposal for this task:\n${JSON.stringify(payload, null, 2)}`,
    },
  ];
}

function extractHermesContent(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : undefined;
  const message = choice?.message;
  if (typeof message?.content === 'string') return message.content.trim();
  if (Array.isArray(message?.content)) {
    return message.content
      .map((part) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();
  }
  if (typeof choice?.text === 'string') return choice.text.trim();
  return '';
}

async function askHermes(request) {
  const response = await fetchWithTimeout(`${hermesApiBase}/chat/completions`, {
    method: 'POST',
    headers: createHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      model: hermesModel,
      stream: false,
      messages: createPrompt(request),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Hermes API returned ${response.status}: ${truncate(body, 260)}`);
  }

  const payload = await response.json();
  const content = extractHermesContent(payload);
  if (!content) {
    throw new Error('Hermes API returned no assistant content.');
  }
  return content;
}

async function createTaskResult(request) {
  const timestamp = nowIso();
  const objective = typeof request.objective === 'string' && request.objective.trim() ? request.objective.trim() : 'Review Mission Control task';
  const title = truncate(objective, 58);
  const safeScope = normalizeScope(request.scope);
  const safeRisk = normalizeRisk(request.risk);
  const agentId = typeof request.targetAgentId === 'string' && request.targetAgentId ? request.targetAgentId : 'hermes-coordinator';
  const responseText = await askHermes(request);
  const commandId = `hermes-task-${createSlug(request.id || objective)}-${Date.now().toString(36)}`;
  const reasoning = truncate(responseText, 900);

  return {
    message: {
      id: `message-${commandId}`,
      author: 'agent',
      body: `${reasoning}\n\nReview the staged command in Command Inbox before anything can execute.`,
      timestamp,
    },
    proposals: [
      {
        id: `proposal-${commandId}`,
        commandId,
        title,
        reasoning,
        risk: safeRisk,
        scope: safeScope,
        agentId,
        agentName: 'Hermes Coordinator',
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
          source: 'agent-bridge:hermes',
          goalId: typeof request.goalId === 'string' ? request.goalId : undefined,
          evidenceIds: Array.isArray(request.evidenceIds) ? request.evidenceIds.filter((item) => typeof item === 'string') : [],
          agent: {
            agentId,
            agentName: 'Hermes Coordinator',
            profile: 'mission-control-operator',
          },
          reasoning,
          expectedResult: 'Mission Control stores this Hermes response as a pending command proposal and waits for human approval.',
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
              actor: 'hermes-mission-control-bridge',
              timestamp,
              detail: `Hermes proposed "${title}" through the Mission Control bridge contract.`,
            },
          ],
        },
      },
      {
        type: 'notification',
        notification: {
          id: `notification-${commandId}`,
          level: safeRisk === 'critical' ? 'critical' : safeRisk === 'elevated' ? 'warning' : 'notice',
          title: 'Hermes proposal ready',
          body: `Command Inbox is holding "${title}" from Hermes.`,
          source: 'agent-bridge:hermes',
          timestamp,
          acknowledged: false,
          relatedCommandId: commandId,
        },
      },
    ],
  };
}

function createSampleJson() {
  return {
    title: 'Hermes bridge snapshot',
    source: 'hermes-mission-control-bridge',
    schemaHint: 'metrics',
    payload: {
      provider: 'hermes',
      mission-controlBridge: `http://${host}:${port}`,
      hermesApiBase,
      model: hermesModel,
      status: lastHermesStatus.ok ? 'connected' : 'offline',
      commandGate: 'Command Inbox required',
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
  response.end(JSON.stringify(payload, null, 2));
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
    await checkHermes();
    sendJson(response, 200, createBridgeStatus());
    return;
  }

  if (request.method === 'GET' && url.pathname === '/sample-json') {
    sendJson(response, 200, createSampleJson());
    return;
  }

  if (request.method === 'GET' && url.pathname === '/events') {
    await checkHermes();
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
      requestCount += 1;
      await checkHermes();
      if (!lastHermesStatus.ok) {
        throw new Error(`Hermes API is offline: ${lastHermesStatus.detail}`);
      }
      const body = await readJsonBody(request);
      const result = await createTaskResult(body);
      broadcast({ type: 'activity', activity: createBridgeStatus().activity });
      broadcast({ type: 'mission-events', events: result.missionControlEvents });
      sendJson(response, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hermes task request failed.';
      sendJson(response, 502, {
        error: message,
        provider: 'hermes',
        hermesApiBase,
      });
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
      broadcast({ type: 'mission-events', events });
      sendJson(response, 200, { sent: events.length });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid emit payload.' });
    }
    return;
  }

  sendJson(response, 404, {
    error: 'Not found',
    endpoints: ['/status', '/events', '/tasks', '/emit', '/sample-json'],
  });
});

server.listen(port, host, async () => {
  await checkHermes();
  console.log(`Mission Control Hermes bridge listening at http://${host}:${port}`);
  console.log(`Hermes API: ${hermesApiBase}`);
  console.log(`Model: ${hermesModel}`);
  console.log('Endpoints: GET /status, GET /events, POST /tasks, POST /emit, GET /sample-json');
});

const heartbeat = setInterval(async () => {
  await checkHermes();
  broadcast({
    type: 'activity',
    activity: createBridgeStatus().activity,
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
