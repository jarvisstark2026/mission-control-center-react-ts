import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function VideoWidget() {
  return (
    <WorkspaceContentShell className="video-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Video"
        title="preview monitor"
        metaEyebrow="source"
        meta="standby"
      />
      <WorkspaceSummaryPanel className="video-summary-panel" title="preview status">
        Playback chrome now uses the shared content hierarchy before handing the remaining space to the monitor stage.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="playback" title="frame preview" meta="offline">
        <div className="video-surface">
          <div className="video-frame" />
          <div className="video-overlay">preview</div>
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

