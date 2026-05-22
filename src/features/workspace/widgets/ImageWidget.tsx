import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function ImageWidget() {
  return (
    <WorkspaceContentShell className="image-surface">
      <WorkspaceContentHeader
        eyebrow="Image workspace"
        title="preview / annotate / crop"
        metaEyebrow="asset"
        meta="drop-ready"
      />
      <WorkspaceSummaryPanel className="image-summary" title="asset staging">
        Preview assets inside the shared workspace shell before annotation tools are connected.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="image-frame-section" eyebrow="canvas" title="no asset loaded" meta="image">
        <div className="image-frame">
          <div className="image-placeholder">
            <span>no asset loaded</span>
            <small>drop / annotate / crop</small>
          </div>
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

