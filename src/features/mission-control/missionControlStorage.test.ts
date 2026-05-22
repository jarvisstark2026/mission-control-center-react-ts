import { afterEach, describe, expect, it } from 'vitest';

import { createInitialMissionControlState, missionControlReducer } from './missionControlReducer';
import {
  clearPersistedMissionControlState,
  loadPersistedMissionControlState,
  savePersistedMissionControlState,
} from './missionControlStorage';

describe('missionControlStorage', () => {
  afterEach(() => {
    clearPersistedMissionControlState();
  });

  it('preserves command decisions and audit across reloads', () => {
    const state = createInitialMissionControlState();
    const approved = missionControlReducer(state, {
      type: 'command-action',
      commandId: 'command-evening-routine',
      action: 'approve',
      role: 'home',
    });

    expect(savePersistedMissionControlState(approved)).toBe(true);

    const reloaded = loadPersistedMissionControlState(createInitialMissionControlState());
    const command = reloaded.commands.find((item) => item.id === 'command-evening-routine');

    expect(command?.status).toBe('queued');
    expect(command?.auditTrail.map((entry) => entry.type)).toContain('approved');
    expect(command?.auditTrail.map((entry) => entry.type)).toContain('queued');
  });
});
