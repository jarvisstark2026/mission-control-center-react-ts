import { describe, expect, it } from 'vitest';

import { addBrowserBookmark, addBrowserHistory, createDefaultBrowserState, normalizeBrowserUrl } from './workspaceBrowserModel';

describe('workspaceBrowserModel', () => {
  it('normalizes browser URLs before navigation', () => {
    expect(normalizeBrowserUrl('example.com')).toBe('https://example.com');
    expect(normalizeBrowserUrl('https://example.com')).toBe('https://example.com');
    expect(normalizeBrowserUrl('data:example.com')).toBe('https://example.com');
  });

  it('records capped browser history and bookmarks', () => {
    const state = createDefaultBrowserState('2026-05-23T10:00:00.000Z');
    const withHistory = addBrowserHistory(state, 'example.com', '2026-05-23T11:00:00.000Z');
    const withBookmark = addBrowserBookmark(withHistory, 'https://openai.com', '2026-05-23T12:00:00.000Z');

    expect(withHistory.history[0]).toMatchObject({ url: 'https://example.com' });
    expect(withBookmark.bookmarks[0]).toMatchObject({ url: 'https://openai.com' });
    expect(withBookmark.bookmarks.length).toBeLessThanOrEqual(12);
  });
});
