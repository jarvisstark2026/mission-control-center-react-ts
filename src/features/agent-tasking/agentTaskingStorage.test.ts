import { afterEach, describe, expect, it } from 'vitest';

import { agentTaskingReducer, createInitialAgentTaskingState } from './agentTaskingModel';
import {
  clearPersistedAgentTaskingState,
  loadPersistedAgentTaskingState,
  savePersistedAgentTaskingState,
} from './agentTaskingStorage';

describe('agentTaskingStorage', () => {
  afterEach(() => {
    clearPersistedAgentTaskingState();
  });

  it('persists local tasking messages and proposals', () => {
    const state = agentTaskingReducer(createInitialAgentTaskingState(), {
      type: 'request-succeeded',
      message: {
        id: 'message-agent',
        author: 'agent',
        body: 'Proposal staged in Command Inbox.',
        timestamp: '2026-05-22T20:00:00.000Z',
      },
      proposals: [
        {
          id: 'proposal-test',
          commandId: 'command-test',
          title: 'Check status',
          reasoning: 'Status check needs a gated approval.',
          risk: 'safe',
          scope: 'support',
          timestamp: '2026-05-22T20:00:00.000Z',
        },
      ],
      timestamp: '2026-05-22T20:00:00.000Z',
    });

    expect(savePersistedAgentTaskingState(state)).toBe(true);

    const loaded = loadPersistedAgentTaskingState(createInitialAgentTaskingState());

    expect(loaded.messages[0]?.body).toBe('Proposal staged in Command Inbox.');
    expect(loaded.proposals[0]?.commandId).toBe('command-test');
  });
});
