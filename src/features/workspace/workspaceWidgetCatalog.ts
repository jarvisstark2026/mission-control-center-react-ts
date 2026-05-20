import type { WorkspaceWidget } from './workspaceTypes';
import type { WidgetBlueprint } from './workspaceStorage';

export const launchableWindowKinds: WorkspaceWidget['kind'][] = [
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

type WorkspaceLauncherEntry = {
  kind: WorkspaceWidget['kind'];
  note: string;
};

const workspaceLauncherNotes: Partial<Record<WorkspaceWidget['kind'], string>> = {
  news: 'open graph library',
  'window-manager': 'track open widgets',
  'trading-graph': 'focus market chart',
};

const workspaceLauncherKinds = launchableWindowKinds.filter((kind) => kind !== 'native-app');

export const widgetBlueprints: Record<WorkspaceWidget['kind'], WidgetBlueprint> = {
  overview: { title: 'Command core', subtitle: 'open / move / stack', surfaceAlpha: 0.11, lineAlpha: 0.18, minWidth: 300, minHeight: 180 },
  graph: { title: 'Telemetry', subtitle: 'live curves', surfaceAlpha: 0.085, lineAlpha: 0.16, minWidth: 280, minHeight: 170 },
  audio: { title: 'Audio preview', subtitle: 'hold / play / mix', surfaceAlpha: 0.1, lineAlpha: 0.17, minWidth: 260, minHeight: 170 },
  map: { title: 'Map / routes', subtitle: 'locations / zones', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 250, minHeight: 170 },
  diagram: { title: 'Diagram preview', subtitle: 'system structure', surfaceAlpha: 0.078, lineAlpha: 0.15, minWidth: 260, minHeight: 170 },
  project: { title: 'Project list', subtitle: 'tasks / backlog', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 260, minHeight: 150 },
  news: { title: 'Markets', subtitle: 'watchlist', surfaceAlpha: 0.078, lineAlpha: 0.14, minWidth: 240, minHeight: 150 },
  schedule: { title: 'Schedule', subtitle: 'day / week / next', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 280, minHeight: 170 },
  launcher: { title: 'App launcher', subtitle: 'apps / desktop hooks', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 280, minHeight: 180 },
  browser: { title: 'Browser', subtitle: 'pages / tabs', surfaceAlpha: 0.074, lineAlpha: 0.14, minWidth: 320, minHeight: 220 },
  'watch-video': { title: 'Live TV', subtitle: 'channels / streams', surfaceAlpha: 0.078, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  'file-explorer': { title: 'File explorer', subtitle: 'folders / files', surfaceAlpha: 0.076, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  'native-app': { title: 'Native app bridge', subtitle: 'installed apps / external windows', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 320, minHeight: 200 },
  'window-manager': { title: 'Registry', subtitle: 'connected surfaces / scopes', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 300, minHeight: 200 },
  sheet: { title: 'Spreadsheet', subtitle: 'cells / formulas', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 320, minHeight: 220 },
  docs: { title: 'Docs', subtitle: 'writing / outline', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  slides: { title: 'Presentation', subtitle: 'deck / speaker notes', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 280, minHeight: 200 },
  'trading-graph': { title: 'Trading graph', subtitle: 'market curves', surfaceAlpha: 0.09, lineAlpha: 0.17, minWidth: 300, minHeight: 180 },
  image: { title: 'Image preview', subtitle: 'preview / annotate', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 240, minHeight: 190 },
  pdf: { title: 'PDF', subtitle: 'read / scan / print', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 260, minHeight: 200 },
  video: { title: 'Media frame', subtitle: 'preview panel', surfaceAlpha: 0.082, lineAlpha: 0.14, minWidth: 260, minHeight: 170 },
  '3d': { title: 'Preview', subtitle: 'files / models', surfaceAlpha: 0.1, lineAlpha: 0.16, minWidth: 300, minHeight: 190 },
  '3d-studio': { title: '3D studio', subtitle: 'gesture / simulate / sculpt', surfaceAlpha: 0.11, lineAlpha: 0.18, minWidth: 360, minHeight: 240 },
  flow: { title: 'Workflows', subtitle: 'library / steps / pdf', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 300, minHeight: 220 },
  list: { title: 'List', subtitle: 'inbox / next steps', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 260, minHeight: 150 },
};

type WidgetPresetLayout = Pick<WorkspaceWidget, 'id' | 'kind' | 'x' | 'y' | 'width' | 'height' | 'zIndex'> &
  Partial<Pick<WorkspaceWidget, 'title' | 'subtitle' | 'minWidth' | 'minHeight' | 'pinned' | 'previewFileId'>>;

const widgetPresetLayouts: WidgetPresetLayout[] = [
  { id: 'overview', kind: 'overview', x: 44, y: 74, width: 390, height: 248, zIndex: 6, pinned: true },
  { id: 'telemetry', kind: 'graph', x: 264, y: 88, width: 350, height: 220, zIndex: 5 },
  { id: 'market-telemetry', kind: 'trading-graph', x: 620, y: 90, width: 378, height: 224, zIndex: 5 },
  { id: 'preview', kind: '3d', x: 528, y: 66, width: 426, height: 258, zIndex: 4, previewFileId: null },
  { id: 'map', kind: 'map', x: 246, y: 286, width: 300, height: 218, zIndex: 3 },
  { id: 'flow', kind: 'flow', x: 560, y: 318, width: 680, height: 420, zIndex: 2, minWidth: 320, minHeight: 320 },
  { id: 'news', kind: 'news', x: 872, y: 94, width: 274, height: 194, zIndex: 1 },
  { id: 'schedule', kind: 'schedule', x: 914, y: 308, width: 292, height: 206, zIndex: 2 },
  { id: 'launcher', kind: 'launcher', x: 586, y: 530, width: 310, height: 194, zIndex: 3 },
  { id: 'browser', kind: 'browser', x: 616, y: 74, width: 392, height: 292, zIndex: 4 },
  { id: 'watch-video', kind: 'watch-video', x: 986, y: 536, width: 276, height: 180, zIndex: 2 },
  { id: 'file-explorer', kind: 'file-explorer', x: 60, y: 330, width: 380, height: 420, zIndex: 3, minWidth: 360, minHeight: 380 },
  { id: 'native-app', kind: 'native-app', x: 420, y: 320, width: 392, height: 238, zIndex: 4 },
  { id: 'window-manager', kind: 'window-manager', x: 840, y: 332, width: 344, height: 238, zIndex: 4 },
  { id: 'sheet', kind: 'sheet', x: 120, y: 772, width: 408, height: 246, zIndex: 2 },
  { id: 'docs', kind: 'docs', x: 548, y: 786, width: 342, height: 232, zIndex: 2 },
  { id: 'slides', kind: 'slides', x: 912, y: 790, width: 330, height: 230, zIndex: 2 },
  { id: 'image', kind: 'image', x: 1260, y: 778, width: 286, height: 224, zIndex: 2 },
  { id: 'pdf', kind: 'pdf', x: 1580, y: 782, width: 300, height: 224, zIndex: 2 },
  { id: 'audio', kind: 'audio', x: 60, y: 548, width: 344, height: 194, zIndex: 2 },
  { id: 'list', kind: 'list', title: 'Project list', subtitle: 'tasks / backlog', x: 418, y: 568, width: 332, height: 174, zIndex: 1 },
];

export const widgetPresets: WorkspaceWidget[] = widgetPresetLayouts.map((layout) => {
  const blueprint = widgetBlueprints[layout.kind];

  return {
    id: layout.id,
    kind: layout.kind,
    title: layout.title ?? blueprint.title,
    subtitle: layout.subtitle ?? blueprint.subtitle,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    zIndex: layout.zIndex,
    surfaceAlpha: blueprint.surfaceAlpha,
    lineAlpha: blueprint.lineAlpha,
    open: true,
    minWidth: layout.minWidth ?? blueprint.minWidth,
    minHeight: layout.minHeight ?? blueprint.minHeight,
    pinned: layout.pinned,
    previewFileId: layout.previewFileId,
  };
});

export function getWidgetLabel(kind: WorkspaceWidget['kind']) {
  return widgetBlueprints[kind].title;
}

export function getWorkspaceLauncherEntries(): WorkspaceLauncherEntry[] {
  return workspaceLauncherKinds.map((kind) => ({
    kind,
    note: workspaceLauncherNotes[kind] ?? 'open in workspace',
  }));
}

export function getFocusedWidget(kind: WorkspaceWidget['kind'], width: number, height: number): WorkspaceWidget {
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
