import { describe, expect, it } from 'vitest';

import {
  canEditAgentSettings,
  canViewAgentControl,
  createInitialAgentControlState,
  getAgentJobSummary,
  getCommandAuditAgentActivity,
  getVisibleAgentDescriptors,
  getVisibleAgentJobs,
  getVisibleAgentPermissions,
} from './agentControlModel';
import { createInitialMissionControlState, missionControlReducer } from '../mission-control';

describe('agentControlModel', () => {
  it('gates Agent Control visibility by role', () => {
    expect(canViewAgentControl('admin')).toBe(true);
    expect(canViewAgentControl('support')).toBe(true);
    expect(canViewAgentControl('home')).toBe(true);
    expect(canViewAgentControl('guest')).toBe(false);
  });

  it('exposes a role-filtered multi-agent registry', () => {
    const state = createInitialAgentControlState();

    expect(getVisibleAgentDescriptors(state, 'admin').map((agent) => agent.id)).toContain('jarvis-security');
    expect(getVisibleAgentDescriptors(state, 'home').map((agent) => agent.id)).toContain('jarvis-home');
    expect(getVisibleAgentDescriptors(state, 'home').map((agent) => agent.id)).not.toContain('jarvis-security');
    expect(getVisibleAgentDescriptors(state, 'guest')).toHaveLength(0);
  });

  it('allows only admins to edit agent settings', () => {
    expect(canEditAgentSettings('admin')).toBe(true);
    expect(canEditAgentSettings('support')).toBe(false);
    expect(canEditAgentSettings('home')).toBe(false);
    expect(canEditAgentSettings('guest')).toBe(false);
  });

  it('filters jobs and permissions for household users', () => {
    const state = createInitialAgentControlState();

    expect(getVisibleAgentJobs(state, 'guest')).toHaveLength(0);
    expect(getVisibleAgentPermissions(state, 'guest')).toHaveLength(0);
    expect(getVisibleAgentJobs(state, 'home').every((job) => job.safeForHome)).toBe(true);
    expect(getVisibleAgentPermissions(state, 'home').some((permission) => permission.risk === 'high')).toBe(false);
    expect(getVisibleAgentPermissions(state, 'support').some((permission) => permission.risk === 'high')).toBe(true);
  });

  it('summarizes scheduled work by status and next run', () => {
    const state = createInitialAgentControlState();
    const summary = getAgentJobSummary(state.jobs);

    expect(summary.total).toBe(4);
    expect(summary.active).toBe(2);
    expect(summary.paused).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.nextRunAt).toBe('2026-05-22T18:05:00.000Z');
  });

  it('derives agent activity from command audit records', () => {
    const state = missionControlReducer(createInitialMissionControlState(), {
      type: 'command-action',
      commandId: 'command-evening-routine',
      action: 'approve',
      role: 'home',
    });

    const activity = getCommandAuditAgentActivity(state.commands, 'admin');

    expect(activity.some((item) => item.title === 'Run evening routine' && item.status === 'approved')).toBe(true);
    expect(getCommandAuditAgentActivity(state.commands, 'guest')).toHaveLength(0);
  });
});
