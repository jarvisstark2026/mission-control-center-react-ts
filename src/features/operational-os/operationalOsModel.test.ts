import { describe, expect, it } from 'vitest';

import type { CommandRequest } from '../mission-control';
import {
  addEvidenceToState,
  addGoalToState,
  canUseAppProfile,
  createEvidence,
  createGoal,
  createInitialOperationalOsState,
  detectJsonSurfaceSchema,
  syncOperationalOsWithCommands,
} from './operationalOsModel';

function createCommand(goalId: string, status: CommandRequest['status']): CommandRequest {
  return {
    id: `command-${status}`,
    title: `Command ${status}`,
    summary: 'A gated operational command.',
    source: 'test',
    goalId,
    evidenceIds: ['evidence-command'],
    agent: {
      agentId: 'jarvis-prime',
      agentName: 'Jarvis Prime',
      profile: 'support-diagnostics',
    },
    reasoning: 'Testing goal linkage.',
    expectedResult: 'Goal state updates from Command Inbox state.',
    scope: 'system',
    risk: 'safe',
    status,
    requestedAt: '2026-05-25T12:00:00.000Z',
    execution: {
      status: 'not-started',
      result: 'Not started.',
      rollbackAvailable: true,
    },
    auditTrail: [
      {
        id: `audit-${status}`,
        type: 'proposed',
        actor: 'test',
        timestamp: '2026-05-25T12:00:00.000Z',
        detail: 'Created for test.',
      },
    ],
  };
}

describe('operational OS model', () => {
  it('creates a starter goal with linked evidence and local app profiles', () => {
    const state = createInitialOperationalOsState('2026-05-25T12:00:00.000Z');

    expect(state.goals[0]?.title).toContain('Mission Control');
    expect(state.evidence[0]?.linkedGoalIds).toContain(state.goals[0]?.id);
    expect(state.appProfiles.some((profile) => profile.id === 'hermes-bridge')).toBe(true);
    expect(state.appProfiles.some((profile) => profile.id === 'local-tools')).toBe(true);
    expect(state.jsonDocuments[0]?.schemaHint).toBe('metrics');
  });

  it('links evidence and command decisions back to the related goal', () => {
    const emptyState = createInitialOperationalOsState('2026-05-25T12:00:00.000Z');
    const goal = createGoal({
      title: 'Audit home energy usage',
      objective: 'Inspect home energy data and create a safe optimization plan.',
      ownerRole: 'admin',
      priority: 'high',
      assignedAgentIds: ['home-agent'],
    });
    const evidence = createEvidence({
      type: 'json',
      title: 'Energy sample',
      source: 'json-surface',
      summary: 'Sample data.',
      goalId: goal.id,
    });

    const withGoal = addGoalToState(emptyState, goal);
    const withEvidence = addEvidenceToState(withGoal, evidence);
    const synced = syncOperationalOsWithCommands(withEvidence, [createCommand(goal.id, 'pending')]);
    const syncedGoal = synced.goals.find((item) => item.id === goal.id);

    expect(syncedGoal?.evidenceIds).toEqual(expect.arrayContaining([evidence.id, 'evidence-command']));
    expect(syncedGoal?.commandIds).toContain('command-pending');
    expect(syncedGoal?.status).toBe('waiting-approval');
  });

  it('detects JSON surface schemas without requiring custom widgets', () => {
    expect(detectJsonSurfaceSchema([{ name: 'Grid', value: 12 }])).toBe('table');
    expect(detectJsonSurfaceSchema([{ title: 'Step one', done: false }])).toBe('checklist');
    expect(detectJsonSurfaceSchema([{ timestamp: '2026-05-25T12:00:00.000Z', title: 'Event' }])).toBe('timeline');
    expect(detectJsonSurfaceSchema({ watts: 1200, source: 'local' })).toBe('metrics');
    expect(detectJsonSurfaceSchema({ command: { title: 'Stage action' } })).toBe('command-proposal');
  });

  it('keeps app portal access role-scoped', () => {
    const profile = createInitialOperationalOsState().appProfiles.find((item) => item.id === 'hermes-bridge');

    if (!profile) throw new Error('missing Hermes bridge profile');

    expect(canUseAppProfile(profile, 'admin')).toBe(true);
    expect(canUseAppProfile(profile, 'support')).toBe(true);
    expect(canUseAppProfile(profile, 'guest')).toBe(false);
  });
});
