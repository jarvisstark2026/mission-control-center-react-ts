import { beforeEach, describe, expect, it } from 'vitest';

import { createLocalFileRecord } from './workspaceLocalFiles';
import {
  addMapPlace,
  addMapRoute,
  addMediaSource,
  addNativeAppProfile,
  canLaunchNativeAppProfile,
  createDefaultDiagramSurfaceState,
  createDefaultMapSurfaceState,
  createDefaultMediaSourceState,
  createDefaultNativeAppProfileState,
  createZeroAudioMetrics,
  getNativeAppProfileType,
  importDiagramJson,
  normalizeDiagramSurfaceState,
  normalizeMapSurfaceState,
  normalizeMediaSourceState,
  normalizeNativeAppProfileState,
  normalizeModelStudioState,
  summarizeAudioAnalyserData,
} from './workspaceWidgetFeatureModels';

describe('workspaceWidgetFeatureModels', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('normalizes and updates local map places and route notes', () => {
    const now = '2026-05-26T10:00:00.000Z';
    const state = createDefaultMapSurfaceState(now);
    const withPlace = addMapPlace(state, { title: 'Hermes PC', detail: 'agent host', handoffUrl: '192.0.2.64' }, now);
    const withRoute = addMapRoute(withPlace, { title: 'Workshop route', detail: 'manual handoff' }, now);

    expect(withRoute.places[0]).toMatchObject({ title: 'Hermes PC', handoffUrl: 'https://192.0.2.64' });
    expect(withRoute.routes[0]).toMatchObject({ title: 'Workshop route' });
    expect(normalizeMapSurfaceState(withRoute, now).selectedPlaceId).toBe(withRoute.places[0].id);
  });

  it('imports diagram JSON with nodes and links', () => {
    const state = createDefaultDiagramSurfaceState('2026-05-26T10:00:00.000Z');
    const result = importDiagramJson(
      state,
      JSON.stringify({
        title: 'Agent loop',
        nodes: [
          { id: 'console', label: 'Console', x: 20, y: 40 },
          { id: 'inbox', label: 'Inbox', x: 74, y: 40 },
        ],
        links: [{ from: 'console', to: 'inbox' }],
      }),
      '2026-05-26T10:01:00.000Z',
    );

    expect(result.error).toBeNull();
    expect(result.state.diagrams[0]).toMatchObject({ title: 'Agent loop', source: 'json' });
    expect(result.state.diagrams[0].links).toHaveLength(1);
    expect(normalizeDiagramSurfaceState(result.state).diagrams[0].nodes).toHaveLength(2);
  });

  it('persists media sources without inventing live data', () => {
    const state = createDefaultMediaSourceState('2026-05-26T10:00:00.000Z');
    const next = addMediaSource(state, 'audio', { name: 'Sample', url: 'example.com/sample.mp3' }, '2026-05-26T10:02:00.000Z');

    expect(next.sources[0]).toMatchObject({ name: 'Sample', url: 'https://example.com/sample.mp3', source: 'browser', mediaKind: 'audio' });
    expect(normalizeMediaSourceState(next, 'audio').selectedSourceId).toBe(next.sources[0].id);
  });

  it('summarizes audio analyser data and preserves silence as zero state', () => {
    expect(createZeroAudioMetrics()).toEqual({ amplitude: 0, peak: 0, dominantFrequencyHz: null });
    expect(summarizeAudioAnalyserData(new Uint8Array(), new Uint8Array())).toEqual(createZeroAudioMetrics());

    const metrics = summarizeAudioAnalyserData(Uint8Array.from([0, 12, 255, 18]), Uint8Array.from([128, 150, 106, 128]), 44_100);
    expect(metrics.peak).toBe(1);
    expect(metrics.amplitude).toBeGreaterThan(0);
    expect(metrics.dominantFrequencyHz).toBeGreaterThan(0);
  });

  it('classifies GLB and GLTF local files as model files', () => {
    const glb = createLocalFileRecord(new File(['model'], 'scene.glb', { type: 'model/gltf-binary' }));
    const gltf = createLocalFileRecord(new File(['{}'], 'scene.gltf', { type: 'model/gltf+json' }));

    expect(glb.previewKind).toBe('model');
    expect(gltf.previewKind).toBe('model');
  });

  it('tracks native app profiles but refuses arbitrary executable launch', () => {
    const state = createDefaultNativeAppProfileState('2026-05-26T10:00:00.000Z');
    const withProtocol = addNativeAppProfile(state, { name: 'Codex', launchTarget: 'codex://' }, '2026-05-26T10:03:00.000Z');
    const withManual = addNativeAppProfile(withProtocol, { name: 'Editor', launchTarget: 'C:\\Tools\\editor.exe' }, '2026-05-26T10:04:00.000Z');

    expect(getNativeAppProfileType('https://example.com')).toBe('web');
    expect(getNativeAppProfileType('codex://')).toBe('protocol');
    expect(getNativeAppProfileType('C:\\Tools\\editor.exe')).toBe('manual');
    expect(withProtocol.profiles[0].allowlistStatus).toBe('approved');
    expect(withManual.profiles[0].allowlistStatus).toBe('blocked');
    expect(canLaunchNativeAppProfile(withProtocol.profiles[0])).toBe(true);
    expect(canLaunchNativeAppProfile(withManual.profiles[0])).toBe(false);
    expect(normalizeNativeAppProfileState(withManual).profiles).toHaveLength(3);
  });

  it('normalizes model studio state without requiring a loaded model', () => {
    expect(normalizeModelStudioState({ selectedModelFileId: 'model-1', lastStatus: 'Selected' })).toMatchObject({
      selectedModelFileId: 'model-1',
      lastStatus: 'Selected',
    });
  });
});
