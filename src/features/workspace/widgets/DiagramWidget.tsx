import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function DiagramWidget() {
  return (
    <WorkspaceContentShell className="diagram-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Diagram"
        title="system topology"
        metaEyebrow="nodes"
        meta="3 linked"
      />
      <WorkspaceSummaryPanel className="diagram-summary-panel" title="topology status">
        Diagram canvases share the same shell rhythm as Markets while keeping the node graph itself intact.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="canvas" title="dependency map" meta="flow">
        <div className="diagram-surface">
          <div className="diagram-node diagram-node-a" />
          <div className="diagram-node diagram-node-b" />
          <div className="diagram-node diagram-node-c" />
          <div className="diagram-link diagram-link-a" />
          <div className="diagram-link diagram-link-b" />
          <div className="diagram-link diagram-link-c" />
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

