import { useEffect, useRef, useState } from 'react';

import { WorkspaceButton, WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { addLiveTvFavorite, createLiveTvSource, getLiveTvStreamType, loadLiveTvState, saveLiveTvState, type LocalLiveTvSource } from '../workspaceLiveTvModel';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';

const liveTvSources: LocalLiveTvSource[] = [
  {
    name: 'Home tuner',
    badge: 'LAN',
    description: 'your local internet TV feed',
    url: 'http://192.168.1.50/live.m3u8',
    streamType: 'hls',
  },
  {
    name: 'Mux demo',
    badge: 'DEMO',
    description: 'public HLS test stream',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    streamType: 'hls',
  },
  {
    name: 'Fallback clip',
    badge: 'MP4',
    description: 'basic playback fallback',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    streamType: 'mp4',
  },
];

const defaultLiveTvSource = liveTvSources.find((source) => source.streamType === 'mp4') ?? liveTvSources[0] ?? {
  name: 'Fallback clip',
  badge: 'MP4',
  description: 'basic playback fallback',
  url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  streamType: 'mp4' as const,
};

export function LiveTvWidget() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [liveTvState, setLiveTvState] = usePersistentWorkspaceState(loadLiveTvState, saveLiveTvState);
  const [draftUrl, setDraftUrl] = useState(defaultLiveTvSource.url);
  const [draftName, setDraftName] = useState('Custom feed');
  const [activeSource, setActiveSource] = useState<LocalLiveTvSource>(defaultLiveTvSource);
  const [status, setStatus] = useState('Ready');
  const [isLoading, setIsLoading] = useState(false);
  const allSources = [...liveTvSources, ...liveTvState.favorites.filter((favorite) => !liveTvSources.some((source) => source.url === favorite.url))];

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    const cleanupPlayer = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    const source = activeSource;
    const sourceUrl = source.url.trim();
    if (!sourceUrl) {
      setStatus('No stream URL loaded');
      return;
    }

    setIsLoading(true);
    setStatus(`Tuning ${source.name}`);
    cleanupPlayer();

    const finishReady = () => {
      if (cancelled) return;
      setIsLoading(false);
      setStatus(`Live on ${source.name}`);
    };

    const attachDirectSource = () => {
      video.src = sourceUrl;
      video.load();
      finishReady();
    };

    const looksLikeHls = source.streamType === 'hls' || /\.m3u8($|\?)/i.test(sourceUrl);
    if (!looksLikeHls) {
      attachDirectSource();
      return () => {
        cancelled = true;
        cleanupPlayer();
      };
    }

    const canPlayHlsNatively = Boolean(video.canPlayType('application/vnd.apple.mpegurl'));
    if (canPlayHlsNatively) {
      attachDirectSource();
      return () => {
        cancelled = true;
        cleanupPlayer();
      };
    }

    void import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setIsLoading(false);
          setStatus('This browser cannot play HLS streams');
          return;
        }

        const player = new Hls({ lowLatencyMode: true, enableWorker: true });
        hlsRef.current = player;
        player.attachMedia(video);
        player.loadSource(sourceUrl);
        player.on(Hls.Events.MANIFEST_PARSED, () => finishReady());
        player.on(Hls.Events.ERROR, (_, data) => {
          if (cancelled) return;
          setIsLoading(false);
          setStatus(`Stream issue on ${source.name}: ${data?.details ?? 'unknown error'}`);
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setIsLoading(false);
        setStatus(`Failed to load HLS engine: ${error instanceof Error ? error.message : 'unknown error'}`);
      });

    return () => {
      cancelled = true;
      cleanupPlayer();
    };
  }, [activeSource]);

  const tuneCustomFeed = () => {
    const nextUrl = draftUrl.trim();
    if (!nextUrl) return;

    setActiveSource(createLiveTvSource(nextUrl, draftName.trim() || 'Custom feed'));
  };

  const saveCustomFeed = () => {
    const nextUrl = draftUrl.trim();
    if (!nextUrl) return;

    const source = createLiveTvSource(nextUrl, draftName.trim() || 'Custom feed');
    setLiveTvState((current) => addLiveTvFavorite(current, source));
    setActiveSource(source);
  };

  return (
    <WorkspaceContentShell className="live-tv-surface">
      <WorkspaceContentHeader
        eyebrow="Live TV"
        title={activeSource.name}
        metaEyebrow={isLoading ? 'tuning' : 'on air'}
        meta={status}
      />

      <WorkspaceSummaryPanel className="live-tv-status-panel" title={activeSource.description}>
        Internet TV playback stays local to the browser. HLS playback is lazy-loaded only when the active source needs it.
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame className="live-tv-source-section" eyebrow="sources" title="channel presets" meta={`${allSources.length} feeds`}>
        <WorkspaceCatalogGrid
          className="live-tv-preset-list"
          variant="live-tv"
          ariaLabel="Live TV sources"
          items={allSources.map((source) => ({
            id: source.url,
            label: source.name,
            note: source.description,
            badge: source.badge,
            active: source.url === activeSource.url,
            state: source.streamType,
          }))}
          onSelect={(item) => {
            const source = allSources.find((candidate) => candidate.url === item.id) ?? defaultLiveTvSource;
            setDraftUrl(source.url);
            setDraftName(source.name);
            setActiveSource(source);
          }}
        />
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="live-tv-controls-section" eyebrow="stream" title="custom feed" meta="HLS / MP4">
        <label className="live-tv-input">
          <span>Source name</span>
          <input
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Name this source"
          />
        </label>
        <label className="live-tv-input">
          <span>Channel or stream URL</span>
          <input
            type="text"
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && tuneCustomFeed()}
            placeholder="Paste an official HLS / MP4 source"
          />
        </label>

        <div className="live-tv-actions">
          <WorkspaceButton className="live-tv-tune-button" onClick={tuneCustomFeed}>
            Tune feed
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" onClick={saveCustomFeed}>
            Save favorite
          </WorkspaceButton>
          <small>{getLiveTvStreamType(draftUrl).toUpperCase()} detected. Use official feeds from your provider or tuner.</small>
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="live-tv-player-section" eyebrow="playback" title="active stream" meta={activeSource.streamType.toUpperCase()}>
        <video ref={videoRef} className="live-tv-frame" controls autoPlay playsInline preload="metadata" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
