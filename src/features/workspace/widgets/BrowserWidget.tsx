import { useState } from 'react';
import { WorkspaceButton, WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function BrowserWidget() {
  const [url, setUrl] = useState('https://example.org');
  const [frameUrl, setFrameUrl] = useState(url);

  const submitUrl = () => {
    let next = url.trim();
    if (!next) return;
    if (!/^https?:\/\//i.test(next)) {
      next = `https://${next.replace(/^data:/i, '')}`;
    }
    setFrameUrl(next);
    setUrl(next);
  };

  return (
    <WorkspaceContentShell className="browser-surface">
      <WorkspaceContentHeader
        className="browser-head"
        eyebrow="Browser"
        title="embedded web preview"
        metaEyebrow="active URL"
        meta={frameUrl.replace(/^https?:\/\//i, '')}
      />

      <WorkspaceSummaryPanel className="browser-summary-panel" title="embedded preview">
        Address controls and bookmarked pages now sit beneath the same status tier as Markets, while the iframe remains contained in the browser stage.
      </WorkspaceSummaryPanel>

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
        </div>
        <WorkspaceCatalogGrid
          className="browser-bookmarks"
          variant="launcher"
          ariaLabel="Browser bookmarks"
          items={['https://example.org', 'https://developer.mozilla.org', 'https://news.ycombinator.com'].map((bookmark) => ({
            id: bookmark,
            label: bookmark.replace('https://', ''),
            note: 'bookmark',
          }))}
          onSelect={(item) => { setUrl(item.id); setFrameUrl(item.id); }}
        />
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="browser-frame-section" eyebrow="preview" title="remote page" meta="iframe">
        <iframe title="Browser preview" src={frameUrl} className="browser-frame" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

