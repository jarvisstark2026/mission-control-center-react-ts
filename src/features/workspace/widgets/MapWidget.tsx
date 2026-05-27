import { useMemo, useState } from 'react';

import type { ShellRole } from '../../shell/roles';
import type { OperationalOsRuntime } from '../../operational-os';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import {
  WorkspaceButton,
  WorkspaceCompactList,
  WorkspaceContentHeader,
  WorkspaceContentShell,
  WorkspaceEmptyState,
  WorkspaceSectionFrame,
  WorkspaceStatusStrip,
} from '../workspaceBlocks';
import { createRuntimeSnapshotEvidenceInput } from '../workspaceEvidenceModel';
import {
  addMapPlace,
  addMapRoute,
  loadMapSurfaceState,
  saveMapSurfaceState,
  type MapSurfacePlace,
  type MapSurfaceRoute,
} from '../workspaceWidgetFeatureModels';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';

function formatMapUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'local';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getMapHandoffUrl(record: Pick<MapSurfacePlace | MapSurfaceRoute, 'handoffUrl' | 'title'>) {
  return record.handoffUrl || `https://www.google.com/maps/search/${encodeURIComponent(record.title)}`;
}

export function MapWidget({ role, operationalOs }: { role: ShellRole; operationalOs: OperationalOsRuntime }) {
  const [mapState, setMapState] = usePersistentWorkspaceState(loadMapSurfaceState, saveMapSurfaceState);
  const [placeTitle, setPlaceTitle] = useState('');
  const [placeDetail, setPlaceDetail] = useState('');
  const [placeUrl, setPlaceUrl] = useState('');
  const [routeTitle, setRouteTitle] = useState('');
  const [routeDetail, setRouteDetail] = useState('');
  const [routeUrl, setRouteUrl] = useState('');

  const selectedPlace = mapState.places.find((place) => place.id === mapState.selectedPlaceId) ?? mapState.places[0] ?? null;
  const selectedRoute = mapState.routes.find((route) => route.id === mapState.selectedRouteId) ?? mapState.routes[0] ?? null;
  const selectedRecord = selectedPlace ?? selectedRoute;
  const visiblePins = useMemo(() => mapState.places.slice(0, 7), [mapState.places]);
  const mapCount = mapState.places.length + mapState.routes.length;

  const savePlace = () => {
    setMapState((current) => addMapPlace(current, { title: placeTitle, detail: placeDetail, handoffUrl: placeUrl }));
    setPlaceTitle('');
    setPlaceDetail('');
    setPlaceUrl('');
  };

  const saveRoute = () => {
    setMapState((current) => addMapRoute(current, { title: routeTitle, detail: routeDetail, handoffUrl: routeUrl }));
    setRouteTitle('');
    setRouteDetail('');
    setRouteUrl('');
  };

  const openExternalMap = (record: MapSurfacePlace | MapSurfaceRoute | null) => {
    if (!record || typeof window === 'undefined') return;
    window.open(getMapHandoffUrl(record), '_blank', 'noopener,noreferrer');
  };

  return (
    <WorkspaceContentShell className="map-widget-shell widget-feature-shell">
      <WorkspaceContentHeader
        eyebrow="Map"
        title={selectedPlace?.title ?? selectedRoute?.title ?? 'local places and routes'}
        metaEyebrow="source"
        meta="local"
      />
      <WorkspaceStatusStrip
        source="local"
        status={mapCount ? `${mapCount} saved map records` : 'no saved map records'}
        count={`${mapState.places.length} places / ${mapState.routes.length} routes`}
        updatedAt={`updated ${formatMapUpdatedAt(mapState.updatedAt)}`}
        action={{
          label: 'Open map',
          disabled: !selectedPlace && !selectedRoute,
          onClick: () => openExternalMap(selectedPlace ?? selectedRoute),
          title: 'Open selected place or route in an external map',
        }}
      />

      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={
          selectedRecord
            ? createRuntimeSnapshotEvidenceInput(
                `${selectedRecord.title} map record`,
                'map-widget',
                `${selectedPlace ? 'place' : 'route'} / ${selectedRecord.detail || 'local map note'} / ${getMapHandoffUrl(selectedRecord)}`,
              )
            : createRuntimeSnapshotEvidenceInput('Map record', 'map-widget', 'No saved place or route selected.')
        }
        disabled={!selectedRecord}
        disabledReason={!selectedRecord ? 'Save or select a place or route before attaching evidence.' : undefined}
      />

      <WorkspaceSectionFrame className="media-widget-stage map-feature-stage" eyebrow="surface" title="saved location layer" meta="local notes">
        <div className="map-surface map-feature-surface" aria-label="Saved map places">
          <div className="map-grid" />
          {visiblePins.map((place, index) => (
            <button
              key={place.id}
              type="button"
              className="map-feature-pin"
              style={{
                left: `${18 + ((index * 23) % 64)}%`,
                top: `${20 + ((index * 17) % 58)}%`,
              }}
              aria-label={`Select ${place.title}`}
              title={place.title}
              data-active={place.id === selectedPlace?.id ? 'true' : undefined}
              onClick={() => setMapState((current) => ({ ...current, selectedPlaceId: place.id, updatedAt: new Date().toISOString() }))}
            />
          ))}
          <div className="map-feature-selection">
            <span>{selectedPlace ? 'selected place' : selectedRoute ? 'selected route' : 'empty'}</span>
            <strong>{selectedPlace?.title ?? selectedRoute?.title ?? 'Add a place or route note'}</strong>
            <small>{selectedPlace?.detail || selectedRoute?.detail || 'Records stay local until opened externally.'}</small>
          </div>
        </div>

        <div className="widget-feature-two-column">
          <div className="widget-feature-form" aria-label="Add map place">
            <label>
              <span>Place</span>
              <input value={placeTitle} onChange={(event) => setPlaceTitle(event.target.value)} placeholder="Workshop, site, address" />
            </label>
            <label>
              <span>Note</span>
              <input value={placeDetail} onChange={(event) => setPlaceDetail(event.target.value)} placeholder="Why this place matters" />
            </label>
            <label>
              <span>Map URL</span>
              <input value={placeUrl} onChange={(event) => setPlaceUrl(event.target.value)} placeholder="optional handoff URL" />
            </label>
            <WorkspaceButton variant="secondary" onClick={savePlace} disabled={!placeTitle.trim()}>
              Save place
            </WorkspaceButton>
          </div>

          <div className="widget-feature-form" aria-label="Add map route">
            <label>
              <span>Route</span>
              <input value={routeTitle} onChange={(event) => setRouteTitle(event.target.value)} placeholder="Delivery, patrol, site visit" />
            </label>
            <label>
              <span>Note</span>
              <input value={routeDetail} onChange={(event) => setRouteDetail(event.target.value)} placeholder="Stops, timing, risk" />
            </label>
            <label>
              <span>Route URL</span>
              <input value={routeUrl} onChange={(event) => setRouteUrl(event.target.value)} placeholder="optional directions URL" />
            </label>
            <WorkspaceButton variant="secondary" onClick={saveRoute} disabled={!routeTitle.trim()}>
              Save route
            </WorkspaceButton>
          </div>
        </div>

        {mapCount ? (
          <WorkspaceCompactList
            ariaLabel="Saved map records"
            items={[
              ...mapState.places.slice(0, 4).map((place) => ({
                id: place.id,
                meta: 'place',
                title: place.title,
                detail: place.detail || 'local saved place',
                state: place.id === selectedPlace?.id ? 'active' : 'local',
                action: {
                  label: place.id === selectedPlace?.id ? 'Open' : 'Select',
                  onClick: () =>
                    place.id === selectedPlace?.id
                      ? openExternalMap(place)
                      : setMapState((current) => ({ ...current, selectedPlaceId: place.id, updatedAt: new Date().toISOString() })),
                },
              })),
              ...mapState.routes.slice(0, 3).map((route) => ({
                id: route.id,
                meta: 'route',
                title: route.title,
                detail: route.detail || 'local route note',
                state: route.id === selectedRoute?.id ? 'active' : 'local',
                action: {
                  label: route.id === selectedRoute?.id ? 'Open' : 'Select',
                  onClick: () =>
                    route.id === selectedRoute?.id
                      ? openExternalMap(route)
                      : setMapState((current) => ({ ...current, selectedRouteId: route.id, updatedAt: new Date().toISOString() })),
                },
              })),
            ]}
            empty="No saved places or routes."
          />
        ) : (
          <WorkspaceEmptyState source="local" title="No places saved" detail="Add a place or route note, then open it in your preferred map provider when needed." />
        )}
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
