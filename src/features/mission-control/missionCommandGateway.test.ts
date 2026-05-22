import { afterEach, describe, expect, it, vi } from 'vitest';

import { initialCommands } from './missionControlMock';
import { createBackendMissionCommandGateway, createMockMissionCommandGateway } from './missionCommandGateway';

describe('missionCommandGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('executes approved commands through the local mock gateway', async () => {
    const gateway = createMockMissionCommandGateway({ delayMs: 0 });
    const command = initialCommands[0];

    await expect(
      gateway.executeCommand({
        command,
        action: 'approve',
        role: 'home',
        requestedAt: '2026-05-22T19:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      status: 'succeeded',
      gatewayMode: 'mock',
      rollbackAvailable: true,
    });
  });

  it('normalizes backend command gateway responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'succeeded',
          result: 'Backend accepted command.',
          rollbackAvailable: true,
          completedAt: '2026-05-22T19:00:01.000Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const gateway = createBackendMissionCommandGateway('/api/commands');
    const command = initialCommands[0];

    const result = await gateway.executeCommand({
      command,
      action: 'approve',
      role: 'admin',
      requestedAt: '2026-05-22T19:00:00.000Z',
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      result: 'Backend accepted command.',
      rollbackAvailable: true,
      completedAt: '2026-05-22T19:00:01.000Z',
      gatewayMode: 'backend',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/commands', expect.objectContaining({ method: 'POST' }));
  });
});
