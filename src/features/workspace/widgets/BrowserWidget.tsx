import { useState } from 'react';

import { WorkspaceButton, WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceEmptyState, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { addBrowserBookmark, addBrowserHistory, loadBrowserState, normalizeBrowserUrl, saveBrowserState } from '../workspaceBrowserModel';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';

export function BrowserWidget() {
  const [browserState, setBrowserState] = usePersistentWorkspaceState(loadBrowserState, saveBrowserState);
  const [url, setUrl] = useState('https://example.org');
  const [frameUrl, setFrameUrl] = useState(url);
  const [frameStatus, setFrameStatus] = useState('Ready');

  const submitUrl = () => {
    const next = normalizeBrowserUrl(url);
    if (!next) return;

    setFrameStatus('Loading');
    setFrameUrl(next);
    setUrl(next);
    setBrowserState((current) => addBrowserHistory(current, next));
  };

  const saveBookmark = () => {
    const next = normalizeBrowserUrl(url || frameUrl);
    if (!next) return;
    setBrowserState((current) => addBrowserBookmark(current, next));
  };

  const bookmarkItems = browserState.bookmarks.map((bookmark) => ({
    id: bookmark.url,
    label: bookmark.label,
    note: 'bookmark',
    active: bookmark.url === frameUrl,
  }));
  const historyItems = browserState.history.map((history) => ({
    id: history.url,
    label: history.label,
    note: new Date(history.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    active: history.url === frameUrl,
  }));

  const navigateTo = (nextUrl: string) => {
    setUrl(nextUrl);
    setFrameUrl(nextUrl);
    setFrameStatus('Loading');
    setBrowserState((current) => addBrowserHistory(current, nextUrl));
  };

  return (
    <WorkspaceContentShell className="browser-surface">
      <WorkspaceContentHeader
        className="browser-head"
        eyebrow="Browser"
        title="embedded web preview"
        metaEyebrow={frameStatus}
        meta={frameUrl.replace(/^https?:\/\//i, '')}
      />

      <WorkspaceStatusStrip
        source="browser"
        status={frameStatus}
        count={`${browserState.bookmarks.length} bookmarks`}
        updatedAt={`${browserState.history.length} history`}
      />

      <WorkspaceSectionFrame className="browser-address-section" eyebrow="address" title="navigation controls" meta="URL / bookmarks">
        <div className="browser-bar">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submitUrl()}
            aria-label="Browser URL"
            placeholder="Enter a website URL"
          />
          <WorkspaceButton className="browser-go-button" onClick={submitUrl}>Go</WorkspaceButton>
          <WorkspaceButton variant="secondary" className="browser-save-button" onClick={saveBookmark}>Save bookmark</WorkspaceButton>
        </div>
        <WorkspaceCatalogGrid
          className="browser-bookmarks"
          variant="launcher"
          ariaLabel="Browser bookmarks"
          items={bookmarkItems}
          onSelect={(item) => navigateTo(item.id)}
        />
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="browser-history-section" eyebrow="history" title="recent pages" meta={`${historyItems.length} saved`}>
        {historyItems.length ? (
          <WorkspaceCatalogGrid
            className="browser-history-list"
            variant="launcher"
            ariaLabel="Browser history"
            items={historyItems}
            onSelect={(item) => navigateTo(item.id)}
          />
        ) : (
          <WorkspaceEmptyState source="browser" title="No history yet" detail="Navigate once and the URL stays available for quick handoff." />
        )}
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="browser-frame-section" eyebrow="preview" title="remote page" meta="iframe">
        <iframe
          title="Browser preview"
          src={frameUrl}
          className="browser-frame"
          onLoad={() => setFrameStatus('Loaded')}
          onError={() => setFrameStatus('Blocked or unavailable')}
        />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
