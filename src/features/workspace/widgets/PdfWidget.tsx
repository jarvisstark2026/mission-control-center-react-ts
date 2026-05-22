import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function PdfWidget() {
  return (
    <WorkspaceContentShell className="pdf-surface">
      <WorkspaceContentHeader
        eyebrow="PDF workspace"
        title="read / search / export"
        metaEyebrow="document"
        meta="page preview"
      />
      <WorkspaceSummaryPanel className="pdf-summary" title="document preview">
        Read-only page staging now follows the same header, summary, and section hierarchy as Markets.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="pdf-page-section" eyebrow="document" title="preview page" meta="pdf">
        <div className="pdf-page">
          <div className="pdf-ribbon" />
          <div className="pdf-lines">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

