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
    id: 'market-telemetry',
    kind: 'trading-graph',
    title: 'Trading graph',
    subtitle: 'market curves',
    x: 620,
    y: 90,
    width: 378,
    height: 224,
    zIndex: 5,
    surfaceAlpha: 0.09,
    lineAlpha: 0.17,
    open: true,
    minWidth: 300,
    minHeight: 180,
  },
  {
    id: 'preview',
    kind: '3d',
    title: '3D model preview',
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
    title: 'Chat preview',
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
    title: 'Video preview',
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
    id: 'sheet',
    kind: 'sheet',
    title: 'Spreadsheet',
    subtitle: 'cells / formulas',
    x: 120,
    y: 772,
    width: 408,
    height: 246,
    zIndex: 2,
    surfaceAlpha: 0.082,
    lineAlpha: 0.15,
    open: true,
    minWidth: 320,
    minHeight: 220,
  },
  {
    id: 'docs',
    kind: 'docs',
    title: 'Docs',
    subtitle: 'writing / outline',
    x: 548,
    y: 786,
    width: 342,
    height: 232,
    zIndex: 2,
    surfaceAlpha: 0.08,
    lineAlpha: 0.14,
    open: true,
    minWidth: 300,
    minHeight: 200,
  },
  {
    id: 'slides',
    kind: 'slides',
    title: 'Presentation',
    subtitle: 'deck / speaker notes',
    x: 912,
    y: 790,
    width: 330,
    height: 230,
    zIndex: 2,
    surfaceAlpha: 0.082,
    lineAlpha: 0.15,
    open: true,
    minWidth: 280,
    minHeight: 200,
  },
  {
    id: 'image',
    kind: 'image',
    title: 'Image preview',
    subtitle: 'preview / annotate',
    x: 1260,
    y: 778,
    width: 286,
    height: 224,
    zIndex: 2,
    surfaceAlpha: 0.08,
    lineAlpha: 0.14,
    open: true,
    minWidth: 240,
    minHeight: 190,
  },
  {
    id: 'pdf',
    kind: 'pdf',
    title: 'PDF',
    subtitle: 'read / scan / print',
    x: 1580,
    y: 782,
    width: 300,
    height: 224,
    zIndex: 2,
    surfaceAlpha: 0.08,
    lineAlpha: 0.14,
    open: true,
    minWidth: 260,
    minHeight: 200,
  },
  {
    id: 'audio',
    kind: 'audio',
    title: 'Audio preview',
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

const defaultOpenKinds = new Set<WorkspaceWidget['kind']>([
  'overview',
  'graph',
  'trading-graph',
  'browser',
  'schedule',
  'launcher',
  'file-explorer',
  'sheet',
]);

const initialWidgetState = widgetPresets.map((widget) => ({
  ...widget,
  open: defaultOpenKinds.has(widget.kind),
}));

const workspaceStorageKey = 'mission-control-center.workspace.layout.v1';

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function loadStoredWidgetState(): WorkspaceWidget[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(workspaceStorageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WorkspaceWidget>[];
    if (!Array.isArray(parsed)) return null;

    const byId = new Map(parsed.filter((item): item is Partial<WorkspaceWidget> & { id: string } => Boolean(item && item.id)).map((item) => [item.id, item]));

    return widgetPresets.map((preset) => {
      const stored = byId.get(preset.id);
      if (!stored) return { ...preset, open: defaultOpenKinds.has(preset.kind) };

      const minWidth = typeof stored.minWidth === 'number' ? stored.minWidth : preset.minWidth;
      const minHeight = typeof stored.minHeight === 'number' ? stored.minHeight : preset.minHeight;

      return {
        ...preset,
        ...stored,
        open: typeof stored.open === 'boolean' ? stored.open : defaultOpenKinds.has(preset.kind),
        minWidth: clampNumber(minWidth, preset.minWidth, 120, 1920),
        minHeight: clampNumber(minHeight, preset.minHeight, 120, 1080),
        width: clampNumber(stored.width, preset.width, minWidth, 4096),
        height: clampNumber(stored.height, preset.height, minHeight, 4096),
        x: clampNumber(stored.x, preset.x, -8192, 8192),
        y: clampNumber(stored.y, preset.y, -8192, 8192),
        zIndex: clampNumber(stored.zIndex, preset.zIndex, 0, 999),
        surfaceAlpha: clampNumber(stored.surfaceAlpha, preset.surfaceAlpha, 0, 1),
        lineAlpha: clampNumber(stored.lineAlpha, preset.lineAlpha, 0, 1),
      };
    });
  } catch {
    return null;
  }
}

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
  'sheet',
  'docs',
  'slides',
  'trading-graph',
  'image',
  'pdf',
  'video',
  '3d',
  '3d-studio',
  'flow',
  'list',
];

const widgetBlueprints: Record<WorkspaceWidget['kind'], { title: string; subtitle: string; surfaceAlpha: number; lineAlpha: number; minWidth: number; minHeight: number }> = {
  overview: { title: 'Command core', subtitle: 'open / move / stack', surfaceAlpha: 0.11, lineAlpha: 0.18, minWidth: 300, minHeight: 180 },
  graph: { title: 'Telemetry', subtitle: 'live curves', surfaceAlpha: 0.085, lineAlpha: 0.16, minWidth: 280, minHeight: 170 },
  audio: { title: 'Audio preview', subtitle: 'hold / play / mix', surfaceAlpha: 0.1, lineAlpha: 0.17, minWidth: 260, minHeight: 170 },
  map: { title: 'Map / routes', subtitle: 'locations / zones', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 250, minHeight: 170 },
  diagram: { title: 'Diagram preview', subtitle: 'system structure', surfaceAlpha: 0.078, lineAlpha: 0.15, minWidth: 260, minHeight: 170 },
  project: { title: 'Project list', subtitle: 'tasks / backlog', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 260, minHeight: 150 },
  news: { title: 'News / market', subtitle: 'watchlist', surfaceAlpha: 0.078, lineAlpha: 0.14, minWidth: 240, minHeight: 150 },
  schedule: { title: 'Schedule', subtitle: 'day / week / next', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 280, minHeight: 170 },
  launcher: { title: 'App launcher', subtitle: 'apps / desktop hooks', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 280, minHeight: 180 },
  browser: { title: 'Browser', subtitle: 'pages / tabs', surfaceAlpha: 0.074, lineAlpha: 0.14, minWidth: 320, minHeight: 220 },
  'watch-video': { title: 'Video preview', subtitle: 'player / playback', surfaceAlpha: 0.078, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  'file-explorer': { title: 'File explorer', subtitle: 'folders / files', surfaceAlpha: 0.076, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  'native-app': { title: 'Native app bridge', subtitle: 'installed apps / external windows', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 320, minHeight: 200 },
  'window-manager': { title: 'Window manager', subtitle: 'open / spawn / route', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 300, minHeight: 200 },
  sheet: { title: 'Spreadsheet', subtitle: 'cells / formulas', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 320, minHeight: 220 },
  docs: { title: 'Docs', subtitle: 'writing / outline', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  slides: { title: 'Presentation', subtitle: 'deck / speaker notes', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 280, minHeight: 200 },
  'trading-graph': { title: 'Trading graph', subtitle: 'market curves', surfaceAlpha: 0.09, lineAlpha: 0.17, minWidth: 300, minHeight: 180 },
  image: { title: 'Image preview', subtitle: 'preview / annotate', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 240, minHeight: 190 },
  pdf: { title: 'PDF', subtitle: 'read / scan / print', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 260, minHeight: 200 },
  video: { title: 'Video preview', subtitle: 'media frame', surfaceAlpha: 0.082, lineAlpha: 0.14, minWidth: 260, minHeight: 170 },
  '3d': { title: '3D model preview', subtitle: 'assets / projects', surfaceAlpha: 0.1, lineAlpha: 0.16, minWidth: 300, minHeight: 190 },
  '3d-studio': { title: '3D studio', subtitle: 'gesture / simulate / sculpt', surfaceAlpha: 0.11, lineAlpha: 0.18, minWidth: 360, minHeight: 240 },
  flow: { title: 'Chat preview', subtitle: 'system logic', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 220, minHeight: 150 },
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

function TradingGraphWidget() {
  return (
    <div className="trading-graph-surface">
      <div className="trading-graph-header">
        <span>market graph</span>
        <strong>price / volume / signal</strong>
      </div>
      <div className="trading-graph-body">
        <div className="trading-graph-grid" />
        <div className="trading-graph-line trading-a" />
        <div className="trading-graph-line trading-b" />
        <div className="trading-graph-volume" />
      </div>
    </div>
  );
}

function SpreadsheetWidget() {
  const columns = ['Q1', 'Q2', 'Q3', 'Q4'];
  const rows = [
    ['Revenue', '18.2', '21.5', '24.0', '26.8'],
    ['Costs', '9.1', '9.6', '10.3', '11.4'],
    ['Margin', '50%', '55%', '57%', '58%'],
    ['Forecast', '14', '16', '18', '20'],
  ];

  return (
    <div className="sheet-surface">
      <div className="sheet-toolbar">
        <span>spreadsheet</span>
        <small>formula bar / grid / cells</small>
      </div>
      <div className="sheet-grid">
        <div className="sheet-corner" />
        {columns.map((col) => (
          <div className="sheet-head" key={col}>{col}</div>
        ))}
        {rows.map((row) => (
          <div className="sheet-row" key={row[0]}>
            <div className="sheet-row-label">{row[0]}</div>
            {row.slice(1).map((cell, index) => (
              <div className="sheet-cell" key={`${row[0]}-${index}`}>{cell}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DocsWidget() {
  const outline = ['Title', 'Abstract', 'Sections', 'Appendix'];
  return (
    <div className="docs-surface">
      <div className="docs-sidebar">
        {outline.map((item) => (
          <div className="docs-outline-item" key={item}>
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div className="docs-page">
        <div className="docs-title">Mission Control Center Brief</div>
        <p>Operational note. This panel behaves like a writing surface: clean sections, careful emphasis, and no unnecessary spectacle.</p>
        <div className="docs-lines">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function SlidesWidget() {
  const slides = ['Vision', 'Stack', 'Workflows', 'Launch'];
  return (
    <div className="slides-surface">
      <div className="slides-stage">
        <div className="slides-canvas">
          <strong>Presentation</strong>
          <p>Deck / speaker notes / command story</p>
        </div>
      </div>
      <div className="slides-strip">
        {slides.map((slide, index) => (
          <button key={slide} type="button" className="slides-thumb">
            <span>{index + 1}</span>
            <small>{slide}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function ImageWidget() {
  return (
    <div className="image-surface">
      <div className="image-frame">
        <div className="image-placeholder">image preview</div>
      </div>
      <div className="image-footer">
        <span>image</span>
        <small>preview / annotate / crop</small>
      </div>
    </div>
  );
}

function PdfWidget() {
  return (
    <div className="pdf-surface">
      <div className="pdf-toolbar">
        <span>pdf</span>
        <small>read / search / export</small>
      </div>
      <div className="pdf-page">
        <div className="pdf-ribbon" />
        <div className="pdf-lines">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
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

function ModelStudioWidget() {
  const simulationCards = [
    { label: 'Structural integrity', value: '92%', note: 'frame / joints / load paths' },
    { label: 'Bend response', value: '0.18 mm', note: 'deformation under torque' },
    { label: 'Stress hotspots', value: '03', note: 'redline zones and stress peaks' },
    { label: 'Heat map', value: '64°C', note: 'thermal climb under runtime load' },
  ];

  const gestureChips = ['drag', 'pinch', 'orbit', 'slice', 'measure', 'simulate'];

  return (
    <div className="model-studio-surface">
      <div className="model-studio-head">
        <div>
          <span>3D asset authoring</span>
          <strong>sculpt / gesture / simulate</strong>
        </div>
        <div className="model-studio-head-meta">
          <span>real-time engineering</span>
          <small>structures · bending · heat · stress</small>
        </div>
      </div>

      <div className="model-studio-layout">
        <section className="model-studio-canvas">
          <div className="model-studio-grid" />
          <div className="model-studio-rig">
            <div className="model-studio-shell model-studio-shell-a" />
            <div className="model-studio-shell model-studio-shell-b" />
            <div className="model-studio-shell model-studio-shell-c" />
          </div>
          <div className="model-studio-axis model-studio-axis-x" />
          <div className="model-studio-axis model-studio-axis-y" />
          <div className="model-studio-axis model-studio-axis-z" />
          <div className="model-studio-canvas-caption">
            <span>touch / stylus / spatial capture ready</span>
            <small>future support for real 3D-space input can slot in here when the hardware catches up.</small>
          </div>
        </section>

        <aside className="model-studio-panel">
          <div className="model-studio-tools">
            {gestureChips.map((chip) => (
              <button type="button" key={chip} className="model-studio-chip">
                {chip}
              </button>
            ))}
          </div>

          <div className="model-studio-simulations">
            {simulationCards.map((card, index) => (
              <article className="model-studio-sim" key={card.label}>
                <div className="model-studio-sim-head">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
                <div className="model-studio-sim-bar">
                  <i style={{ width: `${58 - index * 9}%` }} />
                </div>
                <small>{card.note}</small>
              </article>
            ))}
          </div>

          <div className="model-studio-footer">
            <p>Designed as a fluid creation surface first, with engineering-grade simulation bolted on rather than the other way round.</p>
          </div>
        </aside>
      </div>
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
    { label: 'Audio preview', kind: 'audio' as const },
    { label: 'Map / routes', kind: 'map' as const },
    { label: 'Diagram preview', kind: 'diagram' as const },
    { label: 'Project list', kind: 'project' as const },
    { label: 'News / market', kind: 'news' as const },
    { label: 'Schedule', kind: 'schedule' as const },
    { label: 'App launcher', kind: 'launcher' as const },
    { label: 'Browser', kind: 'browser' as const },
    { label: 'Video preview', kind: 'watch-video' as const },
    { label: 'File explorer', kind: 'file-explorer' as const },
    { label: 'Native app bridge', kind: 'native-app' as const },
    { label: 'Window manager', kind: 'window-manager' as const },
    { label: 'Spreadsheet', kind: 'sheet' as const },
    { label: 'Docs', kind: 'docs' as const },
    { label: 'Presentation', kind: 'slides' as const },
    { label: 'Trading graph', kind: 'trading-graph' as const },
    { label: 'Image preview', kind: 'image' as const },
    { label: 'PDF', kind: 'pdf' as const },
    { label: 'Video preview', kind: 'video' as const },
    { label: '3D model preview', kind: '3d' as const },
    { label: '3D studio', kind: '3d-studio' as const },
    { label: 'Chat preview', kind: 'flow' as const },
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
    { kind: 'watch-video', label: 'Video preview', state: 'playback', action: 'open' },
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
  onClose,
  showChrome = true,
}: {
  widget: WorkspaceWidget;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onStartResize: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onToggleOpen: (id: string) => void;
  onClose: (id: string) => void;
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
          height: `${widget.open ? widget.height : 58}px`,
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

          <div className="widget-chrome-actions" aria-label={`${widget.title} window controls`}>
            <button
              type="button"
              className="widget-toggle"
              onClick={(event) => {
                event.stopPropagation();
                onToggleOpen(widget.id);
              }}
              aria-label={widget.open ? `Collapse ${widget.title}` : `Expand ${widget.title}`}
              title={widget.open ? `Collapse ${widget.title}` : `Expand ${widget.title}`}
            >
              {widget.open ? '▴' : '▾'}
            </button>
            <button
              type="button"
              className="widget-close"
              onClick={(event) => {
                event.stopPropagation();
                onClose(widget.id);
              }}
              aria-label={`Close ${widget.title}`}
              title={`Close ${widget.title}`}
            >
              ×
            </button>
          </div>
        </>
      ) : null}

      <div className="widget-body">
        {widget.kind === 'overview' && <OverviewWidget />}
        {widget.kind === 'graph' && <GraphWidget />}
        {widget.kind === 'trading-graph' && <TradingGraphWidget />}
        {widget.kind === 'sheet' && <SpreadsheetWidget />}
        {widget.kind === 'docs' && <DocsWidget />}
        {widget.kind === 'slides' && <SlidesWidget />}
        {widget.kind === 'image' && <ImageWidget />}
        {widget.kind === 'pdf' && <PdfWidget />}
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
        {widget.kind === '3d-studio' && <ModelStudioWidget />}
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
  const storedWidgets = useMemo(() => loadStoredWidgetState(), []);
  const widgetsRef = useRef(storedWidgets ?? initialWidgetState);
  const interactionRef = useRef<InteractionState | null>(null);
  const compactLayoutAppliedRef = useRef(Boolean(storedWidgets));
  const [widgets, setWidgets] = useState(storedWidgets ?? initialWidgetState);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [nextLaunchIndex, setNextLaunchIndex] = useState(0);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(widgets));
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
    if (!popup) {
      window.location.assign(url.toString());
      return;
    }

    popup.focus?.();
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
    if ((event.target as HTMLElement).closest('button, input, textarea, select, a, video, [role="button"]')) return;

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
      const nextLeft = interaction.startLeft + deltaX;
      const nextTop = interaction.startTop + deltaY;

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

    const nextWidth = Math.max(currentWidget.minWidth, interaction.startWidth + deltaX);
    const nextHeight = Math.max(currentWidget.minHeight, interaction.startHeight + deltaY);

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

  const closeWidget = (id: string) => {
    setWidgets((current) => current.filter((widget) => widget.id !== id));
    widgetsRef.current = widgetsRef.current.filter((widget) => widget.id !== id);
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
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('panel');
                window.location.assign(url.toString());
              }}
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
            onClose={closeWidget}
            showChrome={panelKind === 'browser'}
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
            onClose={closeWidget}
          />
        ))}
      </div>
    </section>
  );
}
