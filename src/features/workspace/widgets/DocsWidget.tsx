import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceRowList, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function DocsWidget() {
  const outlineRows = [
    { id: 'title', primary: 'Title', secondary: 'Mission Control Center Brief', meta: 'ready' },
    { id: 'abstract', primary: 'Abstract', secondary: 'Operational summary', meta: 'draft' },
    { id: 'sections', primary: 'Sections', secondary: 'Architecture Â· Systems Â· Risks', meta: 'in progress' },
    { id: 'appendix', primary: 'Appendix', secondary: 'References and links', meta: 'pending' },
  ];

  return (
    <WorkspaceContentShell className="docs-surface">
      <WorkspaceContentHeader
        eyebrow="Docs"
        title="briefing workspace"
        metaEyebrow="outline"
        meta={`${outlineRows.length} sections`}
      />
      <WorkspaceSummaryPanel title="Mission Control Center Brief">
        Operational note. This panel behaves like a writing surface: clean sections, careful emphasis, and no unnecessary spectacle.
      </WorkspaceSummaryPanel>
      <div className="docs-layout">
        <WorkspaceSectionFrame className="docs-sidebar" eyebrow="outline" title="document map" meta="live draft">
          <WorkspaceRowList rows={outlineRows} className="docs-outline-list" ariaLabel="Document outline" />
        </WorkspaceSectionFrame>
        <WorkspaceSectionFrame className="docs-page" eyebrow="document" title="writing surface" meta="ready">
          <div className="docs-lines" aria-label="Document layout preview">
            <span />
            <span />
            <span />
            <span />
          </div>
        </WorkspaceSectionFrame>
      </div>
    </WorkspaceContentShell>
  );
}

