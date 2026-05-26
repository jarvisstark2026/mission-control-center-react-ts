import { describe, expect, it, vi } from 'vitest';

import { createBridgeAgentTaskGateway, createMockAgentTaskGateway } from './agentTaskGateway';
import {
  agentTaskingBufferLimits,
  agentTaskingReducer,
  canSubmitAgentTask,
  createInitialAgentTaskingState,
} from './agentTaskingModel';
import type { AgentTaskRequest } from './agentTaskingTypes';

function createRequest(overrides: Partial<AgentTaskRequest> = {}): AgentTaskRequest {
  return {
    id: 'task-test',
    objective: 'Check media status and propose a fix.',
    scope: 'support',
    risk: 'safe',
    role: 'support',
    targetAgentId: 'jarvis-support',
    requestedAt: '2026-05-22T20:00:00.000Z',
    ...overrides,
  };
}

describe('agentTaskingModel', () => {
  it('gates task submission by role, scope, and risk', () => {
    expect(canSubmitAgentTask('guest', createRequest({ role: 'guest' }))).toBe(false);
    expect(canSubmitAgentTask('home', createRequest({ role: 'home', scope: 'household', risk: 'safe' }))).toBe(true);
    expect(canSubmitAgentTask('home', createRequest({ role: 'home', scope: 'security', risk: 'critical' }))).toBe(false);
    expect(canSubmitAgentTask('support', createRequest({ role: 'support', scope: 'support', risk: 'elevated' }))).toBe(true);
    expect(canSubmitAgentTask('support', createRequest({ role: 'support', scope: 'security', risk: 'critical' }))).toBe(false);
    expect(canSubmitAgentTask('admin', createRequest({ role: 'admin', scope: 'security', risk: 'critical' }))).toBe(true);
  });

  it('caps local conversation history', () => {
    const state = createInitialAgentTaskingState();
    const next = Array.from({ length: agentTaskingBufferLimits.messages + 8 }, (_, index) => index).reduce(
      (current, index) =>
        agentTaskingReducer(current, {
          type: 'request-started',
          request: createRequest({
            id: `task-${index}`,
            objective: `Objective ${index}`,
            requestedAt: `2026-05-22T20:${String(index).padStart(2, '0')}:00.000Z`,
          }),
        }),
      state,
    );

    expect(next.messages).toHaveLength(agentTaskingBufferLimits.messages);
    expect(next.messages[0]?.body).toBe(`Objective ${agentTaskingBufferLimits.messages + 7}`);
  });

  it('mock gateway creates a message, proposal, notification, and pending command', async () => {
    const gateway = createMockAgentTaskGateway({ delayMs: 0 });
    const result = await gateway.submitTask(createRequest());
    const commandEvent = result.missionControlEvents.find((event) => event.type === 'command');
    const notificationEvent = result.missionControlEvents.find((event) => event.type === 'notification');

    expect(result.message.body).toContain('Command Inbox');
    expect(result.proposals[0]).toMatchObject({
      scope: 'support',
      risk: 'safe',
      agentId: 'jarvis-support',
      agentName: 'Jarvis Support',
    });
    expect(commandEvent).toMatchObject({
      type: 'command',
      command: {
        status: 'pending',
        source: 'agent-console',
        execution: { status: 'not-started' },
      },
    });
    expect(notificationEvent).toMatchObject({
      type: 'notification',
      notification: {
        source: 'agent-console',
      },
    });
  });

  it('mock gateway preserves goal, workflow, evidence, and source provenance', async () => {
    const gateway = createMockAgentTaskGateway({ delayMs: 0 });
    const result = await gateway.submitTask(createRequest({
      source: 'workflow',
      goalId: 'goal-1',
      evidenceIds: ['evidence-1'],
      workflowRunId: 'run-1',
      workflowStepId: 'step-1',
    }));
    const commandEvent = result.missionControlEvents.find((event) => event.type === 'command');

    expect(result.message).toMatchObject({
      goalId: 'goal-1',
      workflowRunId: 'run-1',
      status: 'proposal-created',
    });
    expect(commandEvent).toMatchObject({
      type: 'command',
      command: {
        source: 'workflow-runbook',
        goalId: 'goal-1',
        evidenceIds: ['evidence-1'],
        workflow: {
          runId: 'run-1',
          stepId: 'step-1',
        },
      },
    });
  });

  it('bridge gateway submits tasks to the active bridge task endpoint', async () => {
    const mockResult = await createMockAgentTaskGateway({ delayMs: 0 }).submitTask(createRequest());
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(mockResult), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const gateway = createBridgeAgentTaskGateway('http://127.0.0.1:8787', { fetchImpl });
    const result = await gateway.submitTask(createRequest({ id: 'task-bridge' }));

    expect(gateway.mode).toBe('bridge');
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:8787/tasks', expect.objectContaining({ method: 'POST' }));
    expect(result.message.body).toContain('Command Inbox');
    expect(result.missionControlEvents.some((event) => event.type === 'command')).toBe(true);
  });

  it('bridge gateway rejects invalid proposal payloads and reports diagnostics', async () => {
    const onDiagnostic = vi.fn();
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ message: { id: 'bad' }, proposals: [], missionControlEvents: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const gateway = createBridgeAgentTaskGateway('http://127.0.0.1:8787', { fetchImpl, onDiagnostic });

    await expect(gateway.submitTask(createRequest({ id: 'task-invalid' }))).rejects.toThrow(/invalid proposal payload/i);
    expect(onDiagnostic).toHaveBeenCalledWith(expect.stringMatching(/invalid proposal payload/i), {
      requestId: 'task-invalid',
      objective: 'Check media status and propose a fix.',
    });
  });
});
