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

export function getWidgetLabel(kind: WorkspaceWidget['kind']) {
  return widgetBlueprints[kind].title;
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
