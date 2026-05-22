import { describe, expect, it, vi } from 'vitest';

import { marketGraphs } from './workspaceMarketData';
import { createFallbackMarketLiveState, fetchMarketLiveState } from './workspaceMarketLiveData';

function jsonResponse(payload: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(payload),
  } as Response);
}

describe('workspace market live data', () => {
  it('creates a static fallback quote for every tracked market graph', () => {
    const state = createFallbackMarketLiveState(new Date('2026-05-23T12:00:00.000Z'));

    expect(Object.keys(state.quotes)).toHaveLength(marketGraphs.length);
    expect(state.status).toBe('static');
    expect(state.quotes.btc?.status).toBe('static');
    expect(state.quotes.eurusd?.sourceLabel).toBe('Static fallback');
  });

  it('parses live crypto and FX quotes from public API responses', async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('kraken')) {
        return jsonResponse({
          error: [],
          result: {
            XXBTZUSD: { c: ['107500.0', '0.01'], o: '105030.0' },
            XETHZUSD: { c: ['5200.0', '0.04'], o: '5238.0' },
            SOLUSD: { c: ['240.12', '1.0'], o: '230.47' },
          },
        });
      }

      if (url.includes('/EUR/USD')) {
        return jsonResponse({ amount: 1, base: 'EUR', quote: 'USD', date: '2026-05-22', rate: 1.1714 });
      }

      if (url.includes('/GBP/USD')) {
        return jsonResponse({ amount: 1, base: 'GBP', quote: 'USD', date: '2026-05-22', rate: 1.3291 });
      }

      return jsonResponse({ amount: 1, base: 'USD', quote: 'JPY', date: '2026-05-22', rate: 154.228 });
    });

    const state = await fetchMarketLiveState(fetchImpl, new Date('2026-05-23T12:00:00.000Z'));

    expect(state.status).toBe('ready');
    expect(state.sourceLabel).toBe('Kraken + Frankfurter');
    expect(state.quotes.btc?.status).toBe('live');
    expect(state.quotes.btc?.changeLabel).toBe('+2.35%');
    expect(state.quotes.eurusd?.priceLabel).toBe('1.17140');
    expect(state.quotes.usdjpy?.priceLabel).toBe('154.228');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('keeps usable static fallback data when one public feed fails', async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('kraken')) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: () => Promise.resolve({}),
        } as Response);
      }

      return jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-22', rates: { USD: 1.1714, JPY: 154.228 } });
    });

    const state = await fetchMarketLiveState(fetchImpl, new Date('2026-05-23T12:00:00.000Z'));

    expect(state.status).toBe('partial');
    expect(state.quotes.btc?.status).toBe('static');
    expect(state.quotes.eurusd?.status).toBe('live');
    expect(state.errors[0]).toContain('Kraken crypto feed unavailable');
  });
});
