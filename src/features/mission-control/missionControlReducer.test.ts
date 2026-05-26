import { describe, expect, it } from 'vitest';

import { getMockMissionControlEventBatch } from './missionControlMock';
import { createHomeSystemActionEvents } from '../workspace/homeSystemsActions';
import {
  canAcknowledgeNotifications,
  canEditIntegrationPermission,
  createInitialMissionControlState,
  getAllowedCommandActions,
  missionControlBufferLimits,
  missionControlReducer,
} from './missionControlReducer';
import type { MissionControlEvent } from './missionControlTypes';

describe('missionControlReducer', () => {
  it('applies SSE-style batches and caps telemetry buffers', () => {
    const state = createInitialMissionControlState();
    const events: MissionControlEvent[] = Array.from({ length: missionControlBufferLimits.telemetry + 12 }, (_, index) => ({
      type: 'telemetry',
      sample: {
        id: `sample-${index}`,
        channel: 'network',
        label: `Sample ${index}`,
        value: index,
        unit: 'ms',
        trend: 'flat',
        severity: 'nominal',
        timestamp: `2026-05-22T08:${String(index).padStart(2, '0')}:00.000Z`,
      },
    }));

    const next = missionControlReducer(state, { type: 'events', events });

    expect(next.telemetry).toHaveLength(missionControlBufferLimits.telemetry);
    expect(next.telemetry[0]?.id).toBe(`sample-${events.length - 1}`);
    expect(next.version).toBeGreaterThan(state.version);
  });

  it('enforces role-gated command transitions', () => {
    const state = createInitialMissionControlState();
    const householdCommand = state.commands.find((command) => command.id === 'command-evening-routine');
    const criticalCommand = state.commands.find((command) => command.id === 'command-lockdown-test');

    expect(householdCommand).toBeDefined();
    expect(criticalCommand).toBeDefined();
    expect(getAllowedCommandActions(householdCommand!, 'home')).toEqual(['approve', 'reject']);
    expect(getAllowedCommandActions(criticalCommand!, 'guest')).toEqual([]);
    expect(getAllowedCommandActions(criticalCommand!, 'admin')).toContain('override');

    const guestAttempt = missionControlReducer(state, {
      type: 'command-action',
      commandId: 'command-lockdown-test',
      action: 'override',
      role: 'guest',
    });
    expect(guestAttempt).toBe(state);

    const adminOverride = missionControlReducer(state, {
      type: 'command-action',
      commandId: 'command-lockdown-test',
      action: 'override',
      role: 'admin',
    });
    expect(adminOverride.commands[0]?.id).toBe('command-lockdown-test');
    expect(adminOverride.commands[0]?.status).toBe('queued');
    expect(adminOverride.commands[0]?.execution.status).toBe('queued');
    expect(adminOverride.commands[0]?.auditTrail.map((entry) => entry.type)).toEqual([
      'proposed',
      'overridden',
      'queued',
    ]);
    expect(adminOverride.notifications[0]?.relatedCommandId).toBe('command-lockdown-test');
  });

  it('tracks command provenance, explanations, execution, and audit trail', () => {
    const state = createInitialMissionControlState();
    const command = state.commands.find((item) => item.id === 'command-evening-routine');

    expect(command?.agent.agentName).toBe('Mission Control Coordinator');
    expect(command?.reasoning).toContain('Evening occupancy');
    expect(command?.execution.status).toBe('not-started');
    expect(command?.auditTrail[0]?.type).toBe('proposed');

    const approved = missionControlReducer(state, {
      type: 'command-action',
      commandId: 'command-evening-routine',
      action: 'approve',
      role: 'home',
    });
    const approvedCommand = approved.commands.find((item) => item.id === 'command-evening-routine');

    expect(approvedCommand?.status).toBe('queued');
    expect(approvedCommand?.execution).toMatchObject({
      status: 'queued',
      rollbackAvailable: true,
    });
    expect(approvedCommand?.auditTrail.find((entry) => entry.type === 'approved')).toMatchObject({
      actor: 'home',
      type: 'approved',
    });
  });

  it('accepts Home Systems proposals and preserves audit after approval', () => {
    const state = createInitialMissionControlState();
    const events = createHomeSystemActionEvents('use-solar-surplus', 'home', new Date('2026-05-23T10:00:00.000Z'));
    const staged = missionControlReducer(state, { type: 'events', events });
    const command = staged.commands.find((item) => item.source === 'home-systems:energy');

    expect(command).toMatchObject({
      title: 'Use solar surplus',
      status: 'pending',
      agent: {
        agentName: 'Home Agent',
      },
      auditTrail: [
        {
          type: 'proposed',
          actor: 'home-systems',
        },
      ],
    });

    const approved = missionControlReducer(staged, {
      type: 'command-action',
      commandId: command?.id ?? '',
      action: 'approve',
      role: 'home',
    });
    const approvedCommand = approved.commands.find((item) => item.id === command?.id);

    expect(approvedCommand?.status).toBe('queued');
    expect(approvedCommand?.auditTrail.map((entry) => entry.type)).toEqual(['proposed', 'approved', 'queued']);
    expect(approved.notifications[0]).toMatchObject({
      source: 'command-inbox',
      relatedCommandId: command?.id,
    });
  });

  it('moves approved commands through execution states', () => {
    const state = createInitialMissionControlState();
    const approved = missionControlReducer(state, {
      type: 'command-action',
      commandId: 'command-evening-routine',
      action: 'approve',
      role: 'home',
    });

    const running = missionControlReducer(approved, {
      type: 'command-execution',
      commandId: 'command-evening-routine',
      status: 'running',
      result: 'Local gateway is executing the command.',
      actor: 'mock-command-gateway',
      timestamp: '2026-05-22T19:00:00.000Z',
    });
    const runningCommand = running.commands.find((command) => command.id === 'command-evening-routine');

    expect(runningCommand?.status).toBe('running');
    expect(runningCommand?.execution.status).toBe('running');
    expect(runningCommand?.auditTrail.at(-1)?.type).toBe('running');

    const succeeded = missionControlReducer(running, {
      type: 'command-execution',
      commandId: 'command-evening-routine',
      status: 'succeeded',
      result: 'Mock command completed.',
      actor: 'mock-command-gateway',
      timestamp: '2026-05-22T19:00:01.000Z',
      rollbackAvailable: true,
    });
    const succeededCommand = succeeded.commands.find((command) => command.id === 'command-evening-routine');

    expect(succeededCommand?.status).toBe('succeeded');
    expect(succeededCommand?.execution).toMatchObject({
      status: 'succeeded',
      result: 'Mock command completed.',
      rollbackAvailable: true,
      completedAt: '2026-05-22T19:00:01.000Z',
    });
  });

  it('acknowledges notifications only for non-guest roles', () => {
    const state = createInitialMissionControlState();
    const notificationId = state.notifications[0]?.id ?? '';

    expect(canAcknowledgeNotifications('guest')).toBe(false);
    expect(canAcknowledgeNotifications('support')).toBe(true);

    const guestAttempt = missionControlReducer(state, {
      type: 'acknowledge-notification',
      notificationId,
      role: 'guest',
    });
    expect(guestAttempt).toBe(state);

    const supportAck = missionControlReducer(state, {
      type: 'acknowledge-notification',
      notificationId,
      role: 'support',
    });
    expect(supportAck.notifications.find((notification) => notification.id === notificationId)?.acknowledged).toBe(true);
  });

  it('updates integration heartbeats and gates permission edits to admin', () => {
    const state = createInitialMissionControlState();
    const [heartbeat] = getMockMissionControlEventBatch(1, new Date('2026-05-22T09:00:00.000Z')).filter(
      (event) => event.type === 'integration',
    );

    const withHeartbeat = missionControlReducer(state, {
      type: 'events',
      events: heartbeat ? [heartbeat] : [],
    });

    expect(withHeartbeat.integrations[0]?.heartbeatAt).toBe('2026-05-22T09:00:00.000Z');
    expect(canEditIntegrationPermission('support')).toBe(false);
    expect(canEditIntegrationPermission('admin')).toBe(true);

    const supportAttempt = missionControlReducer(withHeartbeat, {
      type: 'set-integration-permission',
      integrationId: 'integration-media-hub',
      permission: 'blocked',
      role: 'support',
    });
    expect(supportAttempt).toBe(withHeartbeat);

    const adminEdit = missionControlReducer(withHeartbeat, {
      type: 'set-integration-permission',
      integrationId: 'integration-media-hub',
      permission: 'blocked',
      role: 'admin',
    });
    expect(adminEdit.integrations.find((integration) => integration.id === 'integration-media-hub')?.permission).toBe('blocked');
  });
});
