import { WorkspaceCompactList, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';

export function ModelStudioWidget() {
  const rows = [
    { id: 'model-file', meta: 'file', title: 'No 3D model file selected', detail: 'import', state: 'pending' },
    { id: 'measurements', meta: 'measure', title: 'Measurements appear after a supported model loads', detail: 'unavailable', state: 'offline' },
    { id: 'evidence', meta: 'evidence', title: 'Attach model notes through Docs or JSON Surface', detail: 'local', state: 'ready' },
  ];

  return (
    <WorkspaceContentShell className="model-studio-surface">
      <WorkspaceContentHeader
        className="model-studio-head"
        eyebrow="3D asset"
        title="model viewport and inspection"
        metaEyebrow="source"
        meta="no model loaded"
      />
      <WorkspaceStatusStrip source="unavailable" status="waiting for supported 3D model" count="local inspection surface" />

      <div className="model-studio-layout">
        <WorkspaceSectionFrame className="model-studio-canvas-frame" eyebrow="model viewport" title="empty inspection rig" meta="local">
          <div className="model-studio-canvas model-studio-canvas-idle" aria-hidden="true">
            <div className="model-studio-grid" />
            <div className="model-studio-rig">
              <div className="model-studio-shell model-studio-shell-a" />
              <div className="model-studio-shell model-studio-shell-b" />
              <div className="model-studio-shell model-studio-shell-c" />
            </div>
          </div>
        </WorkspaceSectionFrame>

        <WorkspaceSectionFrame className="model-studio-panel" eyebrow="setup" title="model pipeline" meta="real values only">
          <WorkspaceCompactList items={rows} empty="Open a supported model file to inspect real geometry." ariaLabel="Model Studio setup rows" />
        </WorkspaceSectionFrame>
      </div>
    </WorkspaceContentShell>
  );
}
