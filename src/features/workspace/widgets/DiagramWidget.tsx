import { WorkspaceCompactList, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';

export function DiagramWidget() {
  const rows = [
    { id: 'runbooks', meta: 'workflow', title: 'Workflow widget owns active runbook steps', detail: 'linked', state: 'ready' },
    { id: 'json', meta: 'json', title: 'JSON Surface can render agent diagrams when provided', detail: 'import', state: 'ready' },
    { id: 'editor', meta: 'editor', title: 'No diagram document selected', detail: 'local', state: 'pending' },
  ];

  return (
    <WorkspaceContentShell className="diagram-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Diagram"
        title="system topology surface"
        metaEyebrow="source"
        meta="local"
      />
      <WorkspaceStatusStrip source="local" status="no active diagram document" count="workflow links available" />
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="canvas" title="diagram routes" meta="local only">
        <div className="diagram-surface diagram-surface-idle" aria-hidden="true">
          <div className="diagram-node diagram-node-a" />
          <div className="diagram-node diagram-node-b" />
          <div className="diagram-link diagram-link-a" />
        </div>
        <WorkspaceCompactList items={rows} empty="Start from Workflow, JSON Surface, or an imported diagram file." ariaLabel="Diagram setup rows" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
