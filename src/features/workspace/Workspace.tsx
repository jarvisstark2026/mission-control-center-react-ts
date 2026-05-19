import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

import type { WorkspaceWidget } from './workspaceTypes';
import { VisualLab } from '../visual-lab/VisualLab';
import './workspace.css';

const widgetPresets: WorkspaceWidget[] = [
  {
    id: 'overview',
    kind: 'overview',
    title: 'Command core',
    subtitle: 'open / move / stack',
    x: 44,
    y: 74,
    width: 390,
    height: 248,
    zIndex: 6,
    surfaceAlpha: 0.11,
    lineAlpha: 0.18,
    open: true,
    minWidth: 300,
    minHeight: 180,
    pinned: true,
  },
  {
    id: 'telemetry',
    kind: 'graph',
    title: 'Telemetry',
    subtitle: 'live curves',
    x: 264,
    y: 88,
    width: 350,
    height: 220,
    zIndex: 5,
    surfaceAlpha: 0.085,
    lineAlpha: 0.16,
    open: true,
    minWidth: 280,
    minHeight: 170,
  },
  {
    id: 'preview',
    kind: '3d',
    title: '3D preview',
    subtitle: 'assets / projects',
    x: 528,
    y: 66,
    width: 426,
    height: 258,
    zIndex: 4,
    surfaceAlpha: 0.1,
    lineAlpha: 0.16,
    open: true,
    minWidth: 300,
    minHeight: 190,
  },
  {
    id: 'map',
    kind: 'map',
    title: 'Map / routes',
    subtitle: 'locations / zones',
    x: 246,
    y: 286,
    width: 300,
    height: 218,
    zIndex: 3,
    surfaceAlpha: 0.08,
    lineAlpha: 0.15,
    open: true,
    minWidth: 250,
    minHeight: 170,
  },
  {
    id: 'flow',
    kind: 'flow',
    title: 'Flow chart',
    subtitle: 'system logic',
    x: 560,
    y: 318,
    width: 260,
    height: 188,
    zIndex: 2,
    surfaceAlpha: 0.075,
    lineAlpha: 0.14,
    open: true,
    minWidth: 220,
    minHeight: 150,
  },
  {
    id: 'news',
    kind: 'news',
    title: 'News / market',
    subtitle: 'watchlist',
    x: 872,
    y: 94,
    width: 274,
    height: 194,
    zIndex: 1,
    surfaceAlpha: 0.078,
    lineAlpha: 0.14,
    open: true,
    minWidth: 240,
    minHeight: 150,
  },
  {
    id: 'schedule',
    kind: 'schedule',
    title: 'Schedule',
    subtitle: 'day / week / next',
    x: 914,
    y: 308,
    width: 292,
    height: 206,
    zIndex: 2,
    surfaceAlpha: 0.08,
    lineAlpha: 0.14,
    open: true,
    minWidth: 280,
    minHeight: 170,
  },
  {
    id: 'launcher',
    kind: 'launcher',
    title: 'App launcher',
    subtitle: 'apps / desktop hooks',
    x: 586,
    y: 530,
    width: 310,
    height: 194,
    zIndex: 3,
    surfaceAlpha: 0.082,
    lineAlpha: 0.15,
    open: true,
    minWidth: 280,
    minHeight: 180,
  },
  {
    id: 'browser',
    kind: 'browser',
    title: 'Browser',
    subtitle: 'pages / tabs',
    x: 616,
    y: 74,
    width: 392,
    height: 292,
    zIndex: 4,
    surfaceAlpha: 0.074,
    lineAlpha: 0.14,
    open: true,
    minWidth: 320,
    minHeight: 220,
  },
  {
    id: 'watch-video',
    kind: 'watch-video',
    title: 'Watch video',
    subtitle: 'player / playback',
    x: 986,
    y: 536,
    width: 276,
    height: 180,
    zIndex: 2,
    surfaceAlpha: 0.078,
    lineAlpha: 0.14,
    open: true,
    minWidth: 300,
    minHeight: 200,
  },
  {
    id: 'file-explorer',
    kind: 'file-explorer',
    title: 'File explorer',
    subtitle: 'folders / files',
    x: 60,
    y: 330,
    width: 344,
    height: 204,
    zIndex: 3,
    surfaceAlpha: 0.076,
    lineAlpha: 0.14,
    open: true,
    minWidth: 300,
    minHeight: 200,
  },
  {
    id: 'native-app',
    kind: 'native-app',
    title: 'Native app bridge',
    subtitle: 'installed apps / external windows',
    x: 420,
    y: 320,
    width: 392,
    height: 238,
    zIndex: 4,
    surfaceAlpha: 0.08,
    lineAlpha: 0.15,
    open: true,
    minWidth: 320,
    minHeight: 200,
  },
  {
    id: 'window-manager',
    kind: 'window-manager',
    title: 'Window manager',
    subtitle: 'open / spawn / route',
    x: 840,
    y: 332,
    width: 344,
    height: 238,
    zIndex: 4,
    surfaceAlpha: 0.08,
    lineAlpha: 0.15,
    open: true,
    minWidth: 300,
    minHeight: 200,
  },
  {
    id: 'audio',
    kind: 'audio',
    title: 'Audio surface',
    subtitle: 'hold / play / mix',
    x: 60,
    y: 548,
    width: 344,
    height: 194,
    zIndex: 2,
    surfaceAlpha: 0.1,
    lineAlpha: 0.17,
    open: true,
    minWidth: 260,
    minHeight: 170,
  },
  {
    id: 'list',
    kind: 'list',
    title: 'Project list',
    subtitle: 'tasks / backlog',
    x: 418,
    y: 568,
    width: 332,
    height: 174,
    zIndex: 1,
    surfaceAlpha: 0.075,
    lineAlpha: 0.14,
    open: true,
    minWidth: 260,
    minHeight: 150,
  },
];

const launchableWindowKinds: WorkspaceWidget['kind'][] = [
  'overview',
  'graph',
  'audio',
  'map',
  'diagram',
  'project',
  'news',
  'schedule',
  'launcher',
  'browser',
  'watch-video',
  'file-explorer',
  'native-app',
  'window-manager',
  'video',
  '3d',
  'flow',
  'list',
];

const widgetBlueprints: Record<WorkspaceWidget['kind'], { title: string; subtitle: string; surfaceAlpha: number; lineAlpha: number; minWidth: number; minHeight: number }> = {
  overview: { title: 'Command core', subtitle: 'open / move / stack', surfaceAlpha: 0.11, lineAlpha: 0.18, minWidth: 300, minHeight: 180 },
  graph: { title: 'Telemetry', subtitle: 'live curves', surfaceAlpha: 0.085, lineAlpha: 0.16, minWidth: 280, minHeight: 170 },
  audio: { title: 'Audio surface', subtitle: 'hold / play / mix', surfaceAlpha: 0.1, lineAlpha: 0.17, minWidth: 260, minHeight: 170 },
  map: { title: 'Map / routes', subtitle: 'locations / zones', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 250, minHeight: 170 },
  diagram: { title: 'Diagram', subtitle: 'system structure', surfaceAlpha: 0.078, lineAlpha: 0.15, minWidth: 260, minHeight: 170 },
  project: { title: 'Project list', subtitle: 'tasks / backlog', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 260, minHeight: 150 },
  news: { title: 'News / market', subtitle: 'watchlist', surfaceAlpha: 0.078, lineAlpha: 0.14, minWidth: 240, minHeight: 150 },
  schedule: { title: 'Schedule', subtitle: 'day / week / next', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 280, minHeight: 170 },
  launcher: { title: 'App launcher', subtitle: 'apps / desktop hooks', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 280, minHeight: 180 },
  browser: { title: 'Browser', subtitle: 'pages / tabs', surfaceAlpha: 0.074, lineAlpha: 0.14, minWidth: 320, minHeight: 220 },
  'watch-video': { title: 'Watch video', subtitle: 'player / playback', surfaceAlpha: 0.078, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  'file-explorer': { title: 'File explorer', subtitle: 'folders / files', surfaceAlpha: 0.076, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  'native-app': { title: 'Native app bridge', subtitle: 'installed apps / external windows', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 320, minHeight: 200 },
  'window-manager': { title: 'Window manager', subtitle: 'open / spawn / route', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 300, minHeight: 200 },
  video: { title: 'Video', subtitle: 'media frame', surfaceAlpha: 0.082, lineAlpha: 0.14, minWidth: 260, minHeight: 170 },
  '3d': { title: '3D preview', subtitle: 'assets / projects', surfaceAlpha: 0.1, lineAlpha: 0.16, minWidth: 300, minHeight: 190 },
  flow: { title: 'Flow chart', subtitle: 'system logic', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 220, minHeight: 150 },
  list: { title: 'List', subtitle: 'inbox / next steps', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 260, minHeight: 150 },
};

function getWidgetLabel(kind: WorkspaceWidget['kind']) {
  return widgetBlueprints[kind].title;
}

function getFocusedWidget(kind: WorkspaceWidget['kind'], width: number, height: number): WorkspaceWidget {
  const blueprint = widgetBlueprints[kind];

  return {
    id: `panel-${kind}`,
    kind,
    title: blueprint.title,
    subtitle: blueprint.subtitle,
    x: 16,
    y: 84,
    width: Math.max(320, width - 32),
    height: Math.max(220, height - 104),
    zIndex: 9,
    surfaceAlpha: blueprint.surfaceAlpha,
    lineAlpha: blueprint.lineAlpha,
    open: true,
    minWidth: blueprint.minWidth,
    minHeight: blueprint.minHeight,
    pinned: true,
  };
}

function createCompactLayout(boundsWidth: number, boundsHeight: number): WorkspaceWidget[] {
  const stackWidth = Math.max(260, Math.min(boundsWidth - 16, 420));
  const totalWidgets = widgetPresets.length;
  const openCount = boundsHeight < 760 ? 2 : 3;
  const topInset = 58;
  const bottomInset = 12;
  const gap = 8;
  const closedHeight = 44;

  const availableHeight = Math.max(0, boundsHeight - topInset - bottomInset - gap * (totalWidgets - 1));
  const openHeightBudget = Math.max(0, availableHeight - closedHeight * (totalWidgets - openCount));
  const openHeight = Math.max(112, Math.min(160, Math.floor(openHeightBudget / openCount)));

  const openHeights =
    openCount === 2
      ? [openHeight + 10, Math.max(112, openHeight - 6)]
      : [openHeight + 12, Math.max(112, openHeight + 2), Math.max(112, openHeight - 10)];

  let nextY = topInset;

  return widgetPresets.map((widget, index) => {
    const isOpen = index < openCount;
    const height = isOpen ? openHeights[index] ?? openHeight : closedHeight;
    const nextWidget = {
      ...widget,
      x: 8,
      y: nextY,
      width: Math.max(widget.minWidth, stackWidth),
      height,
      zIndex: totalWidgets - index,
      open: isOpen,
    };

    nextY += height + gap;
    return nextWidget;
  });
}

type InteractionState = {
  id: string;
  mode: 'drag' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function OverviewWidget() {
  return (
    <div className="widget-grid overview-grid">
      <div className="stats-arc" />
      <div className="metric-tile">
        <span>system</span>
        <strong>98%</strong>
      </div>
      <div className="metric-tile">
        <span>devices</span>
        <strong>24</strong>
      </div>
      <div className="metric-tile">
        <span>alerts</span>
        <strong>12</strong>
      </div>
      <div className="metric-tile metric-wide">
        <span>workspace mode</span>
        <strong>drag / resize / stack / fade</strong>
      </div>
    </div>
  );
}

function GraphWidget() {
  return (
    <div className="spark-panel">
      <div className="spark-line spark-a" />
      <div className="spark-line spark-b" />
      <div className="spark-line spark-c" />
      <div className="spark-grid" />
      <div className="spark-axis" />
    </div>
  );
}

function AudioWidget() {
  return (
    <div className="audio-surface">
      <div className="audio-ring audio-ring-a" />
      <div className="audio-ring audio-ring-b" />
      <div className="audio-bars">
        {Array.from({ length: 12 }).map((_, index) => (
          <i key={index} style={{ height: `${36 + ((index * 11) % 54)}%` }} />
        ))}
      </div>
    </div>
  );
}

function MapWidget() {
  return (
    <div className="map-surface">
      <div className="map-grid" />
      <div className="map-route map-route-a" />
      <div className="map-route map-route-b" />
      <div className="map-point map-point-a" />
      <div className="map-point map-point-b" />
      <div className="map-point map-point-c" />
    </div>
  );
}

function DiagramWidget() {
  return (
    <div className="diagram-surface">
      <div className="diagram-node diagram-node-a" />
      <div className="diagram-node diagram-node-b" />
      <div className="diagram-node diagram-node-c" />
      <div className="diagram-link diagram-link-a" />
      <div className="diagram-link diagram-link-b" />
      <div className="diagram-link diagram-link-c" />
    </div>
  );
}

function ProjectWidget() {
  return (
    <div className="project-surface">
      {['layout', 'assets', 'review', 'deploy'].map((label, index) => (
        <div className="project-row" key={label}>
          <span>{label}</span>
          <div className="project-track">
            <i style={{ width: `${50 + index * 10}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsWidget() {
  return (
    <div className="news-surface">
      <div className="news-ticker" />
      {['AI systems', 'energy', 'markets', 'home'].map((label) => (
        <div className="news-item" key={label}>
          <span>{label}</span>
          <span>live</span>
        </div>
      ))}
    </div>
  );
}

function VideoWidget() {
  return (
    <div className="video-surface">
      <div className="video-frame" />
      <div className="video-overlay">preview</div>
    </div>
  );
}

function PreviewWidget() {
  return (
    <div className="preview-surface">
      <div className="preview-orb preview-orb-a" />
      <div className="preview-orb preview-orb-b" />
      <div className="preview-ring" />
      <div className="preview-scan" />
    </div>
  );
}

function FlowWidget() {
  return (
    <div className="flow-surface">
      <div className="flow-node flow-node-a" />
      <div className="flow-node flow-node-b" />
      <div className="flow-node flow-node-c" />
      <div className="flow-arrow flow-arrow-a" />
      <div className="flow-arrow flow-arrow-b" />
    </div>
  );
}

function ListWidget() {
  return (
    <div className="list-surface">
      {['inbox', 'next action', 'blocked', 'archive'].map((item) => (
        <div className="list-item" key={item}>
          <span>{item}</span>
          <span>open</span>
        </div>
      ))}
    </div>
  );
}

function ScheduleWidget() {
  const slots = [
    { time: '07:30', label: 'Morning shift', note: 'brief / hydrate / review' },
    { time: '12:15', label: 'Project block', note: 'deep work / build' },
    { time: '16:30', label: 'Check-in', note: 'status / approvals' },
    { time: '21:00', label: 'Wrap-up', note: 'handoff / tidy / plan' },
  ];

  return (
    <div className="schedule-surface">
      <div className="schedule-head">
        <span>Today</span>
        <strong>4 blocks</strong>
      </div>
      {slots.map((slot, index) => (
        <div className="schedule-slot" key={slot.time}>
          <div className="schedule-time">{slot.time}</div>
          <div className="schedule-content">
            <span>{slot.label}</span>
            <small>{slot.note}</small>
          </div>
          <div className="schedule-bar">
            <i style={{ width: `${38 + index * 14}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LauncherWidget() {
  const apps = [
    { label: 'Command core', kind: 'overview' as const },
    { label: 'Telemetry', kind: 'graph' as const },
    { label: 'Audio surface', kind: 'audio' as const },
    { label: 'Map / routes', kind: 'map' as const },
    { label: 'Diagram', kind: 'diagram' as const },
    { label: 'Project list', kind: 'project' as const },
    { label: 'News / market', kind: 'news' as const },
    { label: 'Schedule', kind: 'schedule' as const },
    { label: 'App launcher', kind: 'launcher' as const },
    { label: 'Browser', kind: 'browser' as const },
    { label: 'Watch video', kind: 'watch-video' as const },
    { label: 'File explorer', kind: 'file-explorer' as const },
    { label: 'Native app bridge', kind: 'native-app' as const },
    { label: 'Window manager', kind: 'window-manager' as const },
    { label: 'Video', kind: 'video' as const },
    { label: '3D preview', kind: '3d' as const },
    { label: 'Flow chart', kind: 'flow' as const },
    { label: 'List', kind: 'list' as const },
  ];

  const launch = (kind: (typeof apps)[number]['kind']) => {
    const url = new URL(window.location.href);
    url.searchParams.set('panel', kind);
    window.open(url.toString(), '_blank', 'popup=yes,width=1280,height=900')?.focus?.();
  };

  return (
    <div className="launcher-surface">
      <div className="launcher-summary">
        <span>desktop hooks</span>
        <strong>open / spawn / route</strong>
      </div>
      <div className="launcher-grid">
        {apps.map((app) => (
          <button key={app.kind} type="button" className="launcher-app" onClick={() => launch(app.kind)}>
            <span>{app.label}</span>
            <small>open panel</small>
          </button>
        ))}
      </div>
      <p className="launcher-note">Native app integration can hang off this hook later. For now it is a disciplined preview of the idea.</p>
    </div>
  );
}

function BrowserWidget() {
  const [url, setUrl] = useState('https://example.org');
  const [frameUrl, setFrameUrl] = useState(url);

  const submitUrl = () => {
    let next = url.trim();
    if (!next) return;
    if (!/^https?:\/\//i.test(next) && !next.startsWith('data:')) {
      next = `https://${next}`;
    }
    setFrameUrl(next);
    setUrl(next);
  };

  return (
    <div className="browser-surface">
      <div className="browser-bar">
        <input value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submitUrl()} />
        <button type="button" onClick={submitUrl}>Go</button>
      </div>
      <div className="browser-bookmarks">
        {['https://example.org', 'https://developer.mozilla.org', 'https://news.ycombinator.com'].map((bookmark) => (
          <button key={bookmark} type="button" onClick={() => { setUrl(bookmark); setFrameUrl(bookmark); }}>
            {bookmark.replace('https://', '')}
          </button>
        ))}
      </div>
      <iframe title="Browser preview" src={frameUrl} className="browser-frame" />
    </div>
  );
}

function WatchVideoWidget() {
  return (
    <div className="watch-video-surface">
      <video controls preload="metadata" src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" />
      <div className="watch-video-caption">
        <span>watch video</span>
        <small>stream / scrub / fullscreen</small>
      </div>
    </div>
  );
}

function FileExplorerWidget() {
  const folders = [
    { name: 'Projects', files: ['mission-control-center', 'dailyforge', 'design-assets'] },
    { name: 'Documents', files: ['briefs', 'notes', 'exports'] },
    { name: 'Media', files: ['video', 'audio', 'screens'] },
  ];

  return (
    <div className="file-explorer-surface">
      <div className="file-explorer-path">/home/jarvis</div>
      {folders.map((folder) => (
        <section key={folder.name} className="file-explorer-folder">
          <div className="file-explorer-folder-head">
            <span>{folder.name}</span>
            <small>{folder.files.length} items</small>
          </div>
          <ul>
            {folder.files.map((file) => (
              <li key={file}>
                <span>{file}</span>
                <small>open</small>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}


function NativeAppWidget() {
  const apps = [
    { name: 'Mission Control Center', note: 'primary desktop hub' },
    { name: 'DailyForge', note: 'separate planning surface' },
    { name: 'Browser', note: 'external web window' },
    { name: 'Files', note: 'native file manager' },
    { name: 'Terminal', note: 'command-line session' },
  ];

  return (
    <div className="native-app-surface">
      <div className="native-app-panel">
        <span>desktop bridge</span>
        <strong>open installed app / external window</strong>
        <p>Type the app name or executable path. The bridge remains a placeholder for the real OS integration layer.</p>
      </div>
      <label className="native-app-input">
        <span>App or command</span>
        <input type="text" placeholder="e.g. explorer.exe, notepad.exe, obsidian" />
      </label>
      <div className="native-app-list">
        {apps.map((app) => (
          <button key={app.name} type="button" className="native-app-item">
            <span>{app.name}</span>
            <small>{app.note}</small>
          </button>
        ))}
      </div>
    </div>
  );
}


function WindowManagerWidget() {
  const items = [
    { kind: 'overview', label: 'Command core', state: 'pinned', action: 'raise' },
    { kind: 'launcher', label: 'App launcher', state: 'spawnable', action: 'open' },
    { kind: 'browser', label: 'Browser', state: 'web panel', action: 'open' },
    { kind: 'schedule', label: 'Schedule', state: 'today', action: 'open' },
    { kind: 'native-app', label: 'Native bridge', state: 'desktop handoff', action: 'open' },
    { kind: 'file-explorer', label: 'File explorer', state: 'local files', action: 'open' },
    { kind: 'watch-video', label: 'Watch video', state: 'playback', action: 'open' },
  ];

  return (
    <div className="window-manager-surface">
      <div className="window-manager-head">
        <span>window state</span>
        <strong>{items.length} tracked surfaces</strong>
      </div>
      <div className="window-manager-list">
        {items.map((item) => (
          <button key={item.kind} type="button" className="window-manager-item">
            <span>{item.label}</span>
            <small>{item.state}</small>
          </button>
        ))}
      </div>
      <p className="window-manager-note">This is the first pass at the desktop traffic controller. A little less decorative, a little more useful.</p>
    </div>
  );
}

function WorkspaceWidgetCard({
  widget,
  onStartDrag,
  onStartResize,
  onToggleOpen,
  showChrome = true,
}: {
  widget: WorkspaceWidget;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onStartResize: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onToggleOpen: (id: string) => void;
  showChrome?: boolean;
}) {
  return (
    <article
      className={`workspace-widget ${widget.open ? 'is-open' : 'is-closed'} kind-${widget.kind}`}
      style={
        {
          left: `${widget.x}px`,
          top: `${widget.y}px`,
          width: `${widget.width}px`,
          height: `${widget.height}px`,
          zIndex: widget.zIndex,
          '--widget-surface-alpha': widget.surfaceAlpha,
          '--widget-line-alpha': widget.lineAlpha,
        } as CSSProperties
      }
      onPointerDown={showChrome ? (event) => onStartDrag(event, widget.id) : undefined}
    >
      {showChrome ? (
        <>
          <div className="widget-labels" aria-hidden="true">
            <span className="widget-title">{widget.title}</span>
            <span className="widget-subtitle">{widget.subtitle}</span>
          </div>

          <button
            type="button"
            className="widget-toggle"
            onClick={(event) => {
              event.stopPropagation();
              onToggleOpen(widget.id);
            }}
            aria-label={widget.open ? `Collapse ${widget.title}` : `Open ${widget.title}`}
          >
            {widget.open ? '−' : '+'}
          </button>
        </>
      ) : null}

      <div className="widget-body">
        {widget.kind === 'overview' && <OverviewWidget />}
        {widget.kind === 'graph' && <GraphWidget />}
        {widget.kind === 'audio' && <AudioWidget />}
        {widget.kind === 'map' && <MapWidget />}
        {widget.kind === 'diagram' && <DiagramWidget />}
        {widget.kind === 'project' && <ProjectWidget />}
        {widget.kind === 'news' && <NewsWidget />}
        {widget.kind === 'schedule' && <ScheduleWidget />}
        {widget.kind === 'launcher' && <LauncherWidget />}
        {widget.kind === 'browser' && <BrowserWidget />}
        {widget.kind === 'watch-video' && <WatchVideoWidget />}
        {widget.kind === 'file-explorer' && <FileExplorerWidget />}
        {widget.kind === 'native-app' && <NativeAppWidget />}
        {widget.kind === 'window-manager' && <WindowManagerWidget />}
        {widget.kind === 'video' && <VideoWidget />}
        {widget.kind === '3d' && <PreviewWidget />}
        {widget.kind === 'flow' && <FlowWidget />}
        {widget.kind === 'list' && <ListWidget />}
      </div>

      {showChrome ? (
        <button
          type="button"
          className="widget-resize-handle"
          onPointerDown={(event) => onStartResize(event, widget.id)}
          aria-label={`Resize ${widget.title}`}
        />
      ) : null}
    </article>
  );
}

type WorkspaceProps = {
  panelKind?: WorkspaceWidget['kind'] | null;
};

export function Workspace({ panelKind = null }: WorkspaceProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const widgetsRef = useRef(widgetPresets);
  const interactionRef = useRef<InteractionState | null>(null);
  const compactLayoutAppliedRef = useRef(false);
  const [widgets, setWidgets] = useState(widgetPresets);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [nextLaunchIndex, setNextLaunchIndex] = useState(0);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  useEffect(() => {
    const updateBounds = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    };

    updateBounds();

    const observer = new ResizeObserver(updateBounds);
    if (canvasRef.current) observer.observe(canvasRef.current);

    window.addEventListener('resize', updateBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, []);

  useEffect(() => {
    if (!bounds.width || !bounds.height) return;

    setWidgets((current) =>
      current.map((widget) => ({
        ...widget,
        x: clamp(widget.x, 0, Math.max(0, bounds.width - widget.width)),
        y: clamp(widget.y, 0, Math.max(0, bounds.height - widget.height)),
        width: clamp(widget.width, widget.minWidth, Math.max(widget.minWidth, bounds.width - widget.x)),
        height: clamp(widget.height, widget.minHeight, Math.max(widget.minHeight, bounds.height - widget.y)),
      })),
    );
  }, [bounds.height, bounds.width]);

  useEffect(() => {
    if (!bounds.width || !bounds.height) return;

    const isCompact = bounds.width < 860;
    if (!isCompact) {
      compactLayoutAppliedRef.current = false;
      return;
    }

    if (compactLayoutAppliedRef.current || interactionRef.current) return;

    compactLayoutAppliedRef.current = true;
    setWidgets(createCompactLayout(bounds.width, bounds.height));
  }, [bounds.height, bounds.width]);

  useEffect(() => {
    const stopInteraction = () => {
      interactionRef.current = null;
    };

    window.addEventListener('pointerup', stopInteraction);
    window.addEventListener('pointercancel', stopInteraction);
    window.addEventListener('blur', stopInteraction);

    return () => {
      window.removeEventListener('pointerup', stopInteraction);
      window.removeEventListener('pointercancel', stopInteraction);
      window.removeEventListener('blur', stopInteraction);
    };
  }, []);

  const orderedWidgets = useMemo(() => [...widgets].sort((a, b) => a.zIndex - b.zIndex), [widgets]);
  const nextLaunchKind = launchableWindowKinds[nextLaunchIndex % launchableWindowKinds.length];

  const openPanelWindow = (kind: WorkspaceWidget['kind']) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.set('panel', kind);
    const popup = window.open(url.toString(), '_blank', 'popup=yes,width=1280,height=900');
    popup?.focus?.();
    setNextLaunchIndex((current) => current + 1);
  };

  const openNextPanelWindow = () => {
    openPanelWindow(nextLaunchKind);
  };

  const raiseWidget = (id: string) => {
    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      return current.map((widget) => (widget.id === id ? { ...widget, zIndex: highest + 1 } : widget));
    });
  };

  const startDrag = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button.widget-toggle, button.widget-resize-handle')) return;

    const widget = widgetsRef.current.find((item) => item.id === id);
    const canvas = canvasRef.current;
    if (!widget || !canvas) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    raiseWidget(id);

    interactionRef.current = {
      id,
      mode: 'drag',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: widget.x,
      startTop: widget.y,
      startWidth: widget.width,
      startHeight: widget.height,
    };
  };

  const startResize = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0) return;

    const widget = widgetsRef.current.find((item) => item.id === id);
    if (!widget) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    raiseWidget(id);

    interactionRef.current = {
      id,
      mode: 'resize',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: widget.x,
      startTop: widget.y,
      startWidth: widget.width,
      startHeight: widget.height,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const currentWidget = widgetsRef.current.find((widget) => widget.id === interaction.id);
    if (!currentWidget) return;

    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;

    if (interaction.mode === 'drag') {
      const nextLeft = clamp(
        interaction.startLeft + deltaX,
        0,
        Math.max(0, canvasRect.width - currentWidget.width),
      );
      const nextTop = clamp(
        interaction.startTop + deltaY,
        0,
        Math.max(0, canvasRect.height - currentWidget.height),
      );

      setWidgets((current) =>
        current.map((widget) =>
          widget.id === interaction.id
            ? {
                ...widget,
                x: nextLeft,
                y: nextTop,
              }
            : widget,
        ),
      );
      return;
    }

    const nextWidth = clamp(
      interaction.startWidth + deltaX,
      currentWidget.minWidth,
      Math.max(currentWidget.minWidth, canvasRect.width - interaction.startLeft),
    );
    const nextHeight = clamp(
      interaction.startHeight + deltaY,
      currentWidget.minHeight,
      Math.max(currentWidget.minHeight, canvasRect.height - interaction.startTop),
    );

    setWidgets((current) =>
      current.map((widget) =>
        widget.id === interaction.id
          ? {
              ...widget,
              width: nextWidth,
              height: nextHeight,
            }
          : widget,
      ),
    );
  };

  const stopInteraction = () => {
    interactionRef.current = null;
  };

  const toggleWidget = (id: string) => {
    raiseWidget(id);
    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id ? { ...widget, open: !widget.open, zIndex: widget.zIndex + 1 } : widget,
      ),
    );
  };

  if (panelKind) {
    const focusedWidget = getFocusedWidget(panelKind, bounds.width || 1200, bounds.height || 800);

    return (
      <section className="workspace-shell workspace-shell-panel">
        <div className="workspace-atmosphere workspace-atmosphere-a" aria-hidden="true" />
        <div className="workspace-atmosphere workspace-atmosphere-b" aria-hidden="true" />
        <div className="workspace-grid" aria-hidden="true" />

        <div className="workspace-head workspace-head-panel">
          <div className="workspace-brand">Mission Control Center</div>
          <div className="workspace-chip">detached page · drag the OS window to another screen</div>
          <div className="workspace-launcher">
            <button
              type="button"
              className="workspace-launch-button"
              onClick={() => window.location.assign(window.location.origin + window.location.pathname)}
            >
              Open hub
            </button>
            <button type="button" className="workspace-launch-button is-muted" onClick={() => openPanelWindow(nextLaunchKind)}>
              Add next page
            </button>
          </div>
        </div>

        <div className="workspace-panel-stage">
          <WorkspaceWidgetCard
            widget={focusedWidget}
            onStartDrag={startDrag}
            onStartResize={startResize}
            onToggleOpen={toggleWidget}
            showChrome={false}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-shell">
      <div className="workspace-atmosphere workspace-atmosphere-a" aria-hidden="true" />
      <div className="workspace-atmosphere workspace-atmosphere-b" aria-hidden="true" />
      <div className="workspace-grid" aria-hidden="true" />

      <VisualLab />

      <div className="workspace-head">
        <div className="workspace-brand">Mission Control Center</div>
        <div className="workspace-chip">tailnet live · drag · resize · stack</div>
        <div className="workspace-launcher">
          <button type="button" className="workspace-launch-button" onClick={openNextPanelWindow}>
            Add page · {getWidgetLabel(nextLaunchKind)}
          </button>
          <div className="workspace-launch-pills" aria-label="Window launch shortcuts">
            {launchableWindowKinds.map((kind) => (
              <button key={kind} type="button" className="workspace-launch-pill" onClick={() => openPanelWindow(kind)}>
                {getWidgetLabel(kind)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="workspace-canvas"
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerUp={stopInteraction}
        onPointerCancel={stopInteraction}
      >
        {orderedWidgets.map((widget) => (
          <WorkspaceWidgetCard
            key={widget.id}
            widget={widget}
            onStartDrag={startDrag}
            onStartResize={startResize}
            onToggleOpen={toggleWidget}
          />
        ))}
      </div>
    </section>
  );
}
