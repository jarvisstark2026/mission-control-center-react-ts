import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function AudioWidget() {
  return (
    <WorkspaceContentShell className="audio-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Audio workspace"
        title="signal monitor"
        metaEyebrow="input"
        meta="12 bands"
      />
      <WorkspaceSummaryPanel className="audio-summary-panel" title="audio telemetry">
        Signal monitoring now follows the shared Markets hierarchy: title, concise status, then the active stage.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="spectrum" title="active waveform" meta="visualiser">
        <div className="audio-surface">
          <div className="audio-ring audio-ring-a" />
          <div className="audio-ring audio-ring-b" />
          <div className="audio-bars">
            {Array.from({ length: 12 }).map((_, index) => (
              <i key={index} style={{ height: `${36 + ((index * 11) % 54)}%` }} />
            ))}
          </div>
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

