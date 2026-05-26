import { readLocalStorageJson, writeLocalStorageJson } from './browserStorage';

export type LocalWidgetSource = 'local' | 'file' | 'browser';

export type MapSurfacePlace = {
  id: string;
  title: string;
  detail: string;
  handoffUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type MapSurfaceRoute = {
  id: string;
  title: string;
  detail: string;
  handoffUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type MapSurfaceState = {
  places: MapSurfacePlace[];
  routes: MapSurfaceRoute[];
  selectedPlaceId: string | null;
  selectedRouteId: string | null;
  updatedAt: string;
};

export type DiagramNode = {
  id: string;
  label: string;
  x: number;
  y: number;
};

export type DiagramLink = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type DiagramDocument = {
  id: string;
  title: string;
  source: 'local' | 'json';
  nodes: DiagramNode[];
  links: DiagramLink[];
  createdAt: string;
  updatedAt: string;
};

export type DiagramSurfaceState = {
  diagrams: DiagramDocument[];
  selectedDiagramId: string | null;
  updatedAt: string;
};

export type MediaSourceRecord = {
  id: string;
  name: string;
  url: string;
  source: 'browser';
  mediaKind: 'audio' | 'video';
  createdAt: string;
  updatedAt: string;
};

export type MediaSourceState = {
  sources: MediaSourceRecord[];
  selectedSourceId: string | null;
  updatedAt: string;
};

export type NativeAppProfile = {
  id: string;
  name: string;
  launchTarget: string;
  type: 'web' | 'protocol' | 'manual';
  source: 'local';
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
};

export type NativeAppProfileState = {
  profiles: NativeAppProfile[];
  selectedProfileId: string | null;
  updatedAt: string;
};

export type ModelStudioState = {
  selectedModelFileId: string | null;
  lastModelName: string | null;
  lastStatus: string;
  updatedAt: string;
};

export type AudioMeterMetrics = {
  amplitude: number;
  peak: number;
  dominantFrequencyHz: number | null;
};

const mapSurfaceStorageKey = 'mission-control.map-surface.v1';
const diagramSurfaceStorageKey = 'mission-control.diagram-surface.v1';
const audioMediaStorageKey = 'mission-control.audio-sources.v1';
const videoMediaStorageKey = 'mission-control.video-sources.v1';
const nativeAppProfileStorageKey = 'mission-control.native-app-profiles.v1';
const modelStudioStorageKey = 'mission-control.model-studio.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createId(prefix: string, title: string, now: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${prefix}-${slug || 'item'}-${Date.parse(now) || Date.now()}`;
}

function normalizeText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeUrl(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return '';
  if (/^[a-z][a-z0-9+.-]*:/iu.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizeDate(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

export function createDefaultMapSurfaceState(now = new Date().toISOString()): MapSurfaceState {
  return {
    places: [],
    routes: [],
    selectedPlaceId: null,
    selectedRouteId: null,
    updatedAt: now,
  };
}

function normalizeMapPlace(value: unknown, now: string): MapSurfacePlace | null {
  if (!isRecord(value)) return null;
  const title = normalizeText(value.title);
  if (!title) return null;
  const createdAt = normalizeDate(value.createdAt, now);
  return {
    id: normalizeText(value.id, createId('place', title, createdAt)),
    title,
    detail: normalizeText(value.detail),
    handoffUrl: normalizeUrl(value.handoffUrl),
    createdAt,
    updatedAt: normalizeDate(value.updatedAt, createdAt),
  };
}

function normalizeMapRoute(value: unknown, now: string): MapSurfaceRoute | null {
  if (!isRecord(value)) return null;
  const title = normalizeText(value.title);
  if (!title) return null;
  const createdAt = normalizeDate(value.createdAt, now);
  return {
    id: normalizeText(value.id, createId('route', title, createdAt)),
    title,
    detail: normalizeText(value.detail),
    handoffUrl: normalizeUrl(value.handoffUrl),
    createdAt,
    updatedAt: normalizeDate(value.updatedAt, createdAt),
  };
}

export function normalizeMapSurfaceState(value: unknown, now = new Date().toISOString()): MapSurfaceState {
  if (!isRecord(value)) return createDefaultMapSurfaceState(now);
  const places = Array.isArray(value.places)
    ? value.places.map((item) => normalizeMapPlace(item, now)).filter((item): item is MapSurfacePlace => Boolean(item)).slice(0, 24)
    : [];
  const routes = Array.isArray(value.routes)
    ? value.routes.map((item) => normalizeMapRoute(item, now)).filter((item): item is MapSurfaceRoute => Boolean(item)).slice(0, 24)
    : [];
  const selectedPlaceId = normalizeText(value.selectedPlaceId) || places[0]?.id || null;
  const selectedRouteId = normalizeText(value.selectedRouteId) || routes[0]?.id || null;
  return {
    places,
    routes,
    selectedPlaceId: places.some((place) => place.id === selectedPlaceId) ? selectedPlaceId : places[0]?.id ?? null,
    selectedRouteId: routes.some((route) => route.id === selectedRouteId) ? selectedRouteId : routes[0]?.id ?? null,
    updatedAt: normalizeDate(value.updatedAt, now),
  };
}

export function loadMapSurfaceState(now = new Date().toISOString()) {
  return normalizeMapSurfaceState(readLocalStorageJson<MapSurfaceState>(mapSurfaceStorageKey), now);
}

export function saveMapSurfaceState(state: MapSurfaceState) {
  return writeLocalStorageJson(mapSurfaceStorageKey, state);
}

export function addMapPlace(
  state: MapSurfaceState,
  input: { title: string; detail?: string; handoffUrl?: string },
  now = new Date().toISOString(),
): MapSurfaceState {
  const title = input.title.trim();
  if (!title) return state;
  const place: MapSurfacePlace = {
    id: createId('place', title, now),
    title,
    detail: input.detail?.trim() ?? '',
    handoffUrl: normalizeUrl(input.handoffUrl),
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...state,
    places: [place, ...state.places].slice(0, 24),
    selectedPlaceId: place.id,
    updatedAt: now,
  };
}

export function addMapRoute(
  state: MapSurfaceState,
  input: { title: string; detail?: string; handoffUrl?: string },
  now = new Date().toISOString(),
): MapSurfaceState {
  const title = input.title.trim();
  if (!title) return state;
  const route: MapSurfaceRoute = {
    id: createId('route', title, now),
    title,
    detail: input.detail?.trim() ?? '',
    handoffUrl: normalizeUrl(input.handoffUrl),
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...state,
    routes: [route, ...state.routes].slice(0, 24),
    selectedRouteId: route.id,
    updatedAt: now,
  };
}

export function createDefaultDiagramSurfaceState(now = new Date().toISOString()): DiagramSurfaceState {
  return {
    diagrams: [],
    selectedDiagramId: null,
    updatedAt: now,
  };
}

function normalizeNumber(value: unknown, fallback: number, min = 0, max = 100) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function normalizeDiagramNode(value: unknown, index: number): DiagramNode | null {
  if (!isRecord(value)) return null;
  const label = normalizeText(value.label || value.id, `Node ${index + 1}`);
  return {
    id: normalizeText(value.id, `node-${index + 1}`),
    label,
    x: normalizeNumber(value.x, 18 + (index % 4) * 22),
    y: normalizeNumber(value.y, 22 + Math.floor(index / 4) * 22),
  };
}

function normalizeDiagramLink(value: unknown, index: number, nodeIds: Set<string>): DiagramLink | null {
  if (!isRecord(value)) return null;
  const from = normalizeText(value.from || value.source);
  const to = normalizeText(value.to || value.target);
  if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) return null;
  return {
    id: normalizeText(value.id, `link-${index + 1}`),
    from,
    to,
    label: normalizeText(value.label) || undefined,
  };
}

function normalizeDiagramDocument(value: unknown, now: string): DiagramDocument | null {
  if (!isRecord(value)) return null;
  const title = normalizeText(value.title || value.name);
  if (!title) return null;
  const createdAt = normalizeDate(value.createdAt, now);
  const nodes = Array.isArray(value.nodes)
    ? value.nodes.map((item, index) => normalizeDiagramNode(item, index)).filter((item): item is DiagramNode => Boolean(item)).slice(0, 24)
    : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const links = Array.isArray(value.links)
    ? value.links.map((item, index) => normalizeDiagramLink(item, index, nodeIds)).filter((item): item is DiagramLink => Boolean(item)).slice(0, 32)
    : [];
  return {
    id: normalizeText(value.id, createId('diagram', title, createdAt)),
    title,
    source: value.source === 'json' ? 'json' : 'local',
    nodes,
    links,
    createdAt,
    updatedAt: normalizeDate(value.updatedAt, createdAt),
  };
}

export function normalizeDiagramSurfaceState(value: unknown, now = new Date().toISOString()): DiagramSurfaceState {
  if (!isRecord(value)) return createDefaultDiagramSurfaceState(now);
  const diagrams = Array.isArray(value.diagrams)
    ? value.diagrams.map((item) => normalizeDiagramDocument(item, now)).filter((item): item is DiagramDocument => Boolean(item)).slice(0, 16)
    : [];
  const selectedDiagramId = normalizeText(value.selectedDiagramId) || diagrams[0]?.id || null;
  return {
    diagrams,
    selectedDiagramId: diagrams.some((diagram) => diagram.id === selectedDiagramId) ? selectedDiagramId : diagrams[0]?.id ?? null,
    updatedAt: normalizeDate(value.updatedAt, now),
  };
}

export function loadDiagramSurfaceState(now = new Date().toISOString()) {
  return normalizeDiagramSurfaceState(readLocalStorageJson<DiagramSurfaceState>(diagramSurfaceStorageKey), now);
}

export function saveDiagramSurfaceState(state: DiagramSurfaceState) {
  return writeLocalStorageJson(diagramSurfaceStorageKey, state);
}

export function createDiagramFromTitle(state: DiagramSurfaceState, title: string, now = new Date().toISOString()): DiagramSurfaceState {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return state;
  const diagram: DiagramDocument = {
    id: createId('diagram', normalizedTitle, now),
    title: normalizedTitle,
    source: 'local',
    nodes: [],
    links: [],
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...state,
    diagrams: [diagram, ...state.diagrams].slice(0, 16),
    selectedDiagramId: diagram.id,
    updatedAt: now,
  };
}

export function importDiagramJson(state: DiagramSurfaceState, rawJson: string, now = new Date().toISOString()) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { state, error: 'Invalid JSON.' };
  }

  const document = normalizeDiagramDocument({ ...(isRecord(parsed) ? parsed : {}), source: 'json', createdAt: now, updatedAt: now }, now);
  if (!document || !document.nodes.length) return { state, error: 'JSON must include a title/name and a nodes array.' };

  return {
    state: {
      ...state,
      diagrams: [document, ...state.diagrams.filter((diagram) => diagram.id !== document.id)].slice(0, 16),
      selectedDiagramId: document.id,
      updatedAt: now,
    },
    error: null,
  };
}

export function createDefaultMediaSourceState(now = new Date().toISOString()): MediaSourceState {
  return {
    sources: [],
    selectedSourceId: null,
    updatedAt: now,
  };
}

function normalizeMediaSource(value: unknown, mediaKind: 'audio' | 'video', now: string): MediaSourceRecord | null {
  if (!isRecord(value)) return null;
  const name = normalizeText(value.name);
  const url = normalizeUrl(value.url);
  if (!name || !url) return null;
  const createdAt = normalizeDate(value.createdAt, now);
  return {
    id: normalizeText(value.id, createId(mediaKind, name, createdAt)),
    name,
    url,
    source: 'browser',
    mediaKind,
    createdAt,
    updatedAt: normalizeDate(value.updatedAt, createdAt),
  };
}

export function normalizeMediaSourceState(value: unknown, mediaKind: 'audio' | 'video', now = new Date().toISOString()): MediaSourceState {
  if (!isRecord(value)) return createDefaultMediaSourceState(now);
  const sources = Array.isArray(value.sources)
    ? value.sources.map((item) => normalizeMediaSource(item, mediaKind, now)).filter((item): item is MediaSourceRecord => Boolean(item)).slice(0, 16)
    : [];
  const selectedSourceId = normalizeText(value.selectedSourceId) || sources[0]?.id || null;
  return {
    sources,
    selectedSourceId: sources.some((source) => source.id === selectedSourceId) ? selectedSourceId : sources[0]?.id ?? null,
    updatedAt: normalizeDate(value.updatedAt, now),
  };
}

export function loadAudioMediaState(now = new Date().toISOString()) {
  return normalizeMediaSourceState(readLocalStorageJson<MediaSourceState>(audioMediaStorageKey), 'audio', now);
}

export function saveAudioMediaState(state: MediaSourceState) {
  return writeLocalStorageJson(audioMediaStorageKey, state);
}

export function loadVideoMediaState(now = new Date().toISOString()) {
  return normalizeMediaSourceState(readLocalStorageJson<MediaSourceState>(videoMediaStorageKey), 'video', now);
}

export function saveVideoMediaState(state: MediaSourceState) {
  return writeLocalStorageJson(videoMediaStorageKey, state);
}

export function addMediaSource(
  state: MediaSourceState,
  mediaKind: 'audio' | 'video',
  input: { name: string; url: string },
  now = new Date().toISOString(),
): MediaSourceState {
  const name = input.name.trim();
  const url = normalizeUrl(input.url);
  if (!name || !url) return state;
  const source: MediaSourceRecord = {
    id: createId(mediaKind, name, now),
    name,
    url,
    source: 'browser',
    mediaKind,
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...state,
    sources: [source, ...state.sources.filter((item) => item.url !== source.url)].slice(0, 16),
    selectedSourceId: source.id,
    updatedAt: now,
  };
}

export function createZeroAudioMetrics(): AudioMeterMetrics {
  return {
    amplitude: 0,
    peak: 0,
    dominantFrequencyHz: null,
  };
}

export function summarizeAudioAnalyserData(
  frequencyData: Uint8Array,
  timeDomainData: Uint8Array,
  sampleRate = 44_100,
): AudioMeterMetrics {
  if (!frequencyData.length || !timeDomainData.length) return createZeroAudioMetrics();

  const amplitude = Math.min(
    1,
    timeDomainData.reduce((total, value) => total + Math.abs(value - 128) / 128, 0) / timeDomainData.length,
  );
  const peak = Math.min(1, frequencyData.reduce((max, value) => Math.max(max, value), 0) / 255);
  let strongestIndex = 0;
  let strongestValue = 0;
  frequencyData.forEach((value, index) => {
    if (value > strongestValue) {
      strongestValue = value;
      strongestIndex = index;
    }
  });
  const dominantFrequencyHz = strongestValue > 0 ? Math.round((strongestIndex / frequencyData.length) * (sampleRate / 2)) : null;
  return {
    amplitude: Number(amplitude.toFixed(3)),
    peak: Number(peak.toFixed(3)),
    dominantFrequencyHz,
  };
}

export function createDefaultNativeAppProfileState(now = new Date().toISOString()): NativeAppProfileState {
  return {
    profiles: [
      {
        id: 'profile-mission-control',
        name: 'Mission Control',
        launchTarget: 'http://127.0.0.1:5173/?role=admin',
        type: 'web',
        source: 'local',
        createdAt: now,
        updatedAt: now,
      },
    ],
    selectedProfileId: 'profile-mission-control',
    updatedAt: now,
  };
}

export function getNativeAppProfileType(target: string): NativeAppProfile['type'] {
  const normalized = target.trim();
  if (/^https?:\/\//iu.test(normalized)) return 'web';
  if (/^[a-z][a-z0-9+.-]*:\/?/iu.test(normalized) && !/^[a-z]:[\\/]/iu.test(normalized)) return 'protocol';
  return 'manual';
}

export function canLaunchNativeAppProfile(profile: Pick<NativeAppProfile, 'type'>) {
  return profile.type === 'web' || profile.type === 'protocol';
}

function normalizeNativeAppProfile(value: unknown, now: string): NativeAppProfile | null {
  if (!isRecord(value)) return null;
  const name = normalizeText(value.name);
  const launchTarget = normalizeText(value.launchTarget);
  if (!name || !launchTarget) return null;
  const createdAt = normalizeDate(value.createdAt, now);
  const type = value.type === 'web' || value.type === 'protocol' || value.type === 'manual' ? value.type : getNativeAppProfileType(launchTarget);
  return {
    id: normalizeText(value.id, createId('app', name, createdAt)),
    name,
    launchTarget,
    type,
    source: 'local',
    createdAt,
    updatedAt: normalizeDate(value.updatedAt, createdAt),
    lastOpenedAt: value.lastOpenedAt ? normalizeDate(value.lastOpenedAt, createdAt) : undefined,
  };
}

export function normalizeNativeAppProfileState(value: unknown, now = new Date().toISOString()): NativeAppProfileState {
  const fallback = createDefaultNativeAppProfileState(now);
  if (!isRecord(value)) return fallback;
  const profiles = Array.isArray(value.profiles)
    ? value.profiles.map((item) => normalizeNativeAppProfile(item, now)).filter((item): item is NativeAppProfile => Boolean(item)).slice(0, 16)
    : fallback.profiles;
  const selectedProfileId = normalizeText(value.selectedProfileId) || profiles[0]?.id || null;
  return {
    profiles: profiles.length ? profiles : fallback.profiles,
    selectedProfileId: profiles.some((profile) => profile.id === selectedProfileId) ? selectedProfileId : profiles[0]?.id ?? null,
    updatedAt: normalizeDate(value.updatedAt, now),
  };
}

export function loadNativeAppProfileState(now = new Date().toISOString()) {
  return normalizeNativeAppProfileState(readLocalStorageJson<NativeAppProfileState>(nativeAppProfileStorageKey), now);
}

export function saveNativeAppProfileState(state: NativeAppProfileState) {
  return writeLocalStorageJson(nativeAppProfileStorageKey, state);
}

export function addNativeAppProfile(
  state: NativeAppProfileState,
  input: { name: string; launchTarget: string },
  now = new Date().toISOString(),
): NativeAppProfileState {
  const name = input.name.trim();
  const launchTarget = input.launchTarget.trim();
  if (!name || !launchTarget) return state;
  const profile: NativeAppProfile = {
    id: createId('app', name, now),
    name,
    launchTarget,
    type: getNativeAppProfileType(launchTarget),
    source: 'local',
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...state,
    profiles: [profile, ...state.profiles.filter((item) => item.launchTarget !== profile.launchTarget)].slice(0, 16),
    selectedProfileId: profile.id,
    updatedAt: now,
  };
}

export function markNativeAppProfileOpened(
  state: NativeAppProfileState,
  profileId: string,
  now = new Date().toISOString(),
): NativeAppProfileState {
  return {
    ...state,
    profiles: state.profiles.map((profile) =>
      profile.id === profileId
        ? {
            ...profile,
            lastOpenedAt: now,
            updatedAt: now,
          }
        : profile,
    ),
    selectedProfileId: profileId,
    updatedAt: now,
  };
}

export function createDefaultModelStudioState(now = new Date().toISOString()): ModelStudioState {
  return {
    selectedModelFileId: null,
    lastModelName: null,
    lastStatus: 'No model selected.',
    updatedAt: now,
  };
}

export function normalizeModelStudioState(value: unknown, now = new Date().toISOString()): ModelStudioState {
  if (!isRecord(value)) return createDefaultModelStudioState(now);
  return {
    selectedModelFileId: normalizeText(value.selectedModelFileId) || null,
    lastModelName: normalizeText(value.lastModelName) || null,
    lastStatus: normalizeText(value.lastStatus, 'No model selected.'),
    updatedAt: normalizeDate(value.updatedAt, now),
  };
}

export function loadModelStudioState(now = new Date().toISOString()) {
  return normalizeModelStudioState(readLocalStorageJson<ModelStudioState>(modelStudioStorageKey), now);
}

export function saveModelStudioState(state: ModelStudioState) {
  return writeLocalStorageJson(modelStudioStorageKey, state);
}
