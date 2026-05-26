import { describe, expect, it } from 'vitest';

import { createHomeSystemActionEvents, getHomeSystemActionPlansForRole } from './homeSystemsActions';

describe('homeSystemsActions', () => {
  it('exposes safe household action plans to home users and critical actions only to admin', () => {
    expect(getHomeSystemActionPlansForRole('home').map((plan) => plan.id)).toContain('use-solar-surplus');
    expect(getHomeSystemActionPlansForRole('home').map((plan) => plan.id)).not.toContain('arm-alarm');
    expect(getHomeSystemActionPlansForRole('support').map((plan) => plan.id)).toEqual(['run-home-diagnostics']);
    expect(getHomeSystemActionPlansForRole('guest')).toEqual([]);
  });

  it('creates Command Inbox proposals and related notifications from home actions', () => {
    const events = createHomeSystemActionEvents('use-solar-surplus', 'home', new Date('2026-05-23T10:00:00.000Z'));

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: 'command',
      command: {
        title: 'Use solar surplus',
        source: 'home-systems:energy',
        scope: 'household',
        risk: 'safe',
        status: 'pending',
        agent: {
          agentName: 'Home Agent',
        },
      },
    });
    expect(events[1]).toMatchObject({
      type: 'notification',
      notification: {
        source: 'home-systems',
        title: 'Home proposal staged: Use solar surplus',
      },
    });
  });

  it('does not create proposals for roles that cannot stage that home action', () => {
    expect(createHomeSystemActionEvents('arm-alarm', 'home')).toEqual([]);
    expect(createHomeSystemActionEvents('use-solar-surplus', 'guest')).toEqual([]);
  });
});
