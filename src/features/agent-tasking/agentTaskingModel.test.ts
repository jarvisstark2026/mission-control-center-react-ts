import { describe, expect, it } from 'vitest';

import { createMockAgentTaskGateway } from './agentTaskGateway';
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
});
