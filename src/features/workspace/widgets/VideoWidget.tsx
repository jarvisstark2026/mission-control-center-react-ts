import { WorkspaceCompactList, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';

export function VideoWidget() {
  const rows = [
    { id: 'local-file', meta: 'file', title: 'Open local video through File Explorer or Preview', detail: 'file source', state: 'ready' },
    { id: 'stream', meta: 'url', title: 'No stream URL configured in this widget', detail: 'unavailable', state: 'offline' },
    { id: 'evidence', meta: 'evidence', title: 'Attach selected clips to a goal from Preview', detail: 'local', state: 'ready' },
  ];

  return (
    <WorkspaceContentShell className="video-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Video"
        title="local preview and stream handoff"
        metaEyebrow="source"
        meta="not configured"
      />
      <WorkspaceStatusStrip source="unavailable" status="no active video source" count="use local file intake" />
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="playback" title="available routes" meta="source required">
        <div className="video-surface video-surface-idle" aria-hidden="true">
          <div className="video-frame" />
          <div className="video-overlay">standby</div>
        </div>
        <WorkspaceCompactList items={rows} empty="Load a local video file or configure a stream source." ariaLabel="Video setup rows" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
