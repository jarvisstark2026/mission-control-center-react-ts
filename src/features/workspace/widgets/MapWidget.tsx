import { WorkspaceCompactList, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';

export function MapWidget() {
  const rows = [
    { id: 'provider', meta: 'provider', title: 'No live map provider configured', detail: 'unavailable', state: 'offline' },
    { id: 'local-notes', meta: 'local', title: 'Use goals/evidence to track location notes', detail: 'manual', state: 'ready' },
    { id: 'routes', meta: 'routes', title: 'Route overlays wait for a real feed or imported file', detail: 'setup', state: 'pending' },
  ];

  return (
    <WorkspaceContentShell className="map-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Map"
        title="route and location surface"
        metaEyebrow="source"
        meta="not connected"
      />
      <WorkspaceStatusStrip source="unavailable" status="no map feed configured" count="local notes ready" />
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="map" title="setup state" meta="local grid">
        <div className="map-surface map-surface-idle" aria-hidden="true">
          <div className="map-grid" />
        </div>
        <WorkspaceCompactList items={rows} empty="Connect a provider or attach a map file to a goal." ariaLabel="Map setup rows" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
