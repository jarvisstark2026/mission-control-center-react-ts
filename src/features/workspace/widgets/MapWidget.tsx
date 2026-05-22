import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function MapWidget() {
  return (
    <WorkspaceContentShell className="map-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Navigation"
        title="route overview"
        metaEyebrow="waypoints"
        meta="3 markers"
      />
      <WorkspaceSummaryPanel className="map-summary-panel" title="route telemetry">
        Navigation now follows the shared Markets hierarchy: concise status first, then the active map stage.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="map" title="active route" meta="local grid">
        <div className="map-surface">
          <div className="map-grid" />
          <div className="map-route map-route-a" />
          <div className="map-route map-route-b" />
          <div className="map-point map-point-a" />
          <div className="map-point map-point-b" />
          <div className="map-point map-point-c" />
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

