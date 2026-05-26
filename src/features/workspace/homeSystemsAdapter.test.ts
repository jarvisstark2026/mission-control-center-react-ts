import { describe, expect, it, vi } from 'vitest';

import { createLocalHomeSystemsPayload, fetchHomeSystemsPayload } from './homeSystemsAdapter';

function jsonResponse(payload: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(payload),
  } as Response);
}

describe('homeSystemsAdapter', () => {
  it('creates a local baseline payload when no local backend is configured', () => {
    const payload = createLocalHomeSystemsPayload(new Date('2026-05-23T10:00:00.000Z'));

    expect(payload.sourceStatus).toBe('local-baseline');
    expect(payload.snapshot.solarPvKw).toBeGreaterThan(0);
    expect(payload.dailyProfile.length).toBeGreaterThan(6);
    expect(payload.records.length).toBeGreaterThan(6);
  });

  it('normalizes a backend-ready payload with partial data', async () => {
    const fetchImpl = vi.fn(() =>
      jsonResponse({
        snapshot: {
          consumptionKw: 2.5,
          generationKw: 5.1,
        },
        updatedAt: '2026-05-23T11:00:00.000Z',
      }),
    );

    const payload = await fetchHomeSystemsPayload('http://local-home/api/home-systems', fetchImpl);

    expect(payload.sourceStatus).toBe('backend-ready');
    expect(payload.snapshot.consumptionKw).toBe(2.5);
    expect(payload.snapshot.generationKw).toBe(5.1);
    expect(payload.snapshot.batteryPercent).toBeGreaterThan(0);
    expect(payload.dailyProfile.length).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalledWith('http://local-home/api/home-systems');
  });
});
