import { useEffect, useRef, useState } from 'react';
import { WorkspaceButton, WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

type LiveTvSource = {
  name: string;
  badge: string;
  description: string;
  url: string;
  streamType: 'hls' | 'mp4';
};

const liveTvSources: LiveTvSource[] = [
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

const defaultLiveTvSource = liveTvSources[0] ?? {
  name: 'Fallback clip',
  badge: 'MP4',
  description: 'basic playback fallback',
  url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  streamType: 'mp4',
};

export function LiveTvWidget() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [draftUrl, setDraftUrl] = useState(defaultLiveTvSource.url);
  const [activeSource, setActiveSource] = useState<LiveTvSource>(defaultLiveTvSource);
  const [status, setStatus] = useState('Ready');
  const [isLoading, setIsLoading] = useState(false);

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
      void video.play().catch(() => undefined);
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

    const isHlsFeed = /\.m3u8($|\?)/i.test(nextUrl);

    setActiveSource({
      name: 'Custom feed',
      badge: isHlsFeed ? 'HLS' : 'URL',
      description: 'your chosen internet TV source',
      url: nextUrl,
      streamType: isHlsFeed ? 'hls' : 'mp4',
    });
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
        Internet TV playback stays inside the shared workspace shell, with source presets and custom feeds kept as local widget controls.
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame className="live-tv-source-section" eyebrow="sources" title="channel presets" meta={`${liveTvSources.length} feeds`}>
        <WorkspaceCatalogGrid
          className="live-tv-preset-list"
          variant="live-tv"
          ariaLabel="Live TV sources"
          items={liveTvSources.map((source) => ({
            id: source.name,
            label: source.name,
            note: source.description,
            badge: source.badge,
            active: source.name === activeSource.name,
            state: source.streamType,
          }))}
          onSelect={(item) => {
            const source = liveTvSources.find((candidate) => candidate.name === item.id) ?? defaultLiveTvSource;
            setDraftUrl(source.url);
            setActiveSource(source);
          }}
        />
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="live-tv-controls-section" eyebrow="stream" title="custom feed" meta="HLS / MP4">
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
          <small>Best with official HLS (.m3u8) feeds from your provider or home tuner.</small>
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="live-tv-player-section" eyebrow="playback" title="active stream" meta={activeSource.streamType.toUpperCase()}>
        <video ref={videoRef} className="live-tv-frame" controls autoPlay playsInline preload="metadata" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

