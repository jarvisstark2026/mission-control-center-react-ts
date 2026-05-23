import { readLocalStorageJson, writeLocalStorageJson } from './browserStorage';
import { marketCategories } from './workspaceMarketData';

export const marketWatchlistStorageKey = 'mission-control-center.market-watchlist.v1';

const allMarketGraphIds = marketCategories.flatMap((category) => category.graphs.map((graph) => graph.id));
const defaultWatchlistIds = ['spx', 'btc', 'eth', 'sol', 'gold'].filter((id) => allMarketGraphIds.includes(id));

export function normalizeMarketWatchlist(ids: string[]) {
  const validIds = ids.filter((id, index) => allMarketGraphIds.includes(id) && ids.indexOf(id) === index);
  return validIds.length ? validIds : defaultWatchlistIds;
}

export function toggleMarketWatchlist(ids: string[], graphId: string) {
  if (!allMarketGraphIds.includes(graphId)) return normalizeMarketWatchlist(ids);
  if (ids.includes(graphId)) return normalizeMarketWatchlist(ids.filter((id) => id !== graphId));
  return normalizeMarketWatchlist([...ids, graphId]);
}

export function loadMarketWatchlist() {
  const parsed = readLocalStorageJson<string[]>(marketWatchlistStorageKey);
  return normalizeMarketWatchlist(Array.isArray(parsed) ? parsed : defaultWatchlistIds);
}

export function saveMarketWatchlist(ids: string[]) {
  return writeLocalStorageJson(marketWatchlistStorageKey, normalizeMarketWatchlist(ids));
}
