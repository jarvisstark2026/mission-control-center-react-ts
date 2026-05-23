import { describe, expect, it } from 'vitest';

import { normalizeMarketWatchlist, toggleMarketWatchlist } from './workspaceMarketWatchlistModel';

describe('workspaceMarketWatchlistModel', () => {
  it('keeps only valid unique market graph ids', () => {
    expect(normalizeMarketWatchlist(['spx', 'spx', 'missing'])).toEqual(['spx']);
  });

  it('toggles valid watchlist symbols', () => {
    expect(toggleMarketWatchlist(['spx'], 'btc')).toEqual(['spx', 'btc']);
    expect(toggleMarketWatchlist(['spx', 'btc'], 'btc')).toEqual(['spx']);
  });
});
