import { readLocalStorageJson, writeLocalStorageJson } from './browserStorage';

export type BrowserHistoryEntry = {
  id: string;
  url: string;
  label: string;
  visitedAt: string;
};

export type BrowserState = {
  bookmarks: BrowserHistoryEntry[];
  history: BrowserHistoryEntry[];
};

export const browserStorageKey = 'mission-control-center.browser.v1';

const defaultBookmarks = ['https://example.org', 'https://developer.mozilla.org', 'https://news.ycombinator.com'];

export function normalizeBrowserUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^data:/i, '')}`;
}

export function createBrowserEntry(url: string, now = new Date().toISOString()): BrowserHistoryEntry {
  const normalizedUrl = normalizeBrowserUrl(url);
  return {
    id: normalizedUrl,
    url: normalizedUrl,
    label: normalizedUrl.replace(/^https?:\/\//i, ''),
    visitedAt: now,
  };
}

export function createDefaultBrowserState(now = new Date().toISOString()): BrowserState {
  return {
    bookmarks: defaultBookmarks.map((bookmark) => createBrowserEntry(bookmark, now)),
    history: [],
  };
}

function dedupeEntries(entries: BrowserHistoryEntry[], limit: number) {
  const byId = new Map<string, BrowserHistoryEntry>();
  entries.forEach((entry) => {
    if (entry.url) byId.set(entry.url, entry);
  });
  return Array.from(byId.values()).slice(0, limit);
}

export function addBrowserHistory(state: BrowserState, url: string, now = new Date().toISOString()): BrowserState {
  const entry = createBrowserEntry(url, now);
  if (!entry.url) return state;

  return {
    ...state,
    history: dedupeEntries([entry, ...state.history], 12),
  };
}

export function addBrowserBookmark(state: BrowserState, url: string, now = new Date().toISOString()): BrowserState {
  const entry = createBrowserEntry(url, now);
  if (!entry.url) return state;

  return {
    ...state,
    bookmarks: dedupeEntries([entry, ...state.bookmarks], 12),
  };
}

export function loadBrowserState(now = new Date().toISOString()) {
  const parsed = readLocalStorageJson<BrowserState>(browserStorageKey);
  if (!Array.isArray(parsed?.bookmarks) || !Array.isArray(parsed?.history)) return createDefaultBrowserState(now);
  return parsed;
}

export function saveBrowserState(state: BrowserState) {
  return writeLocalStorageJson(browserStorageKey, state);
}
