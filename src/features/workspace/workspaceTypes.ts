export type WidgetKind =
  | 'overview'
  | 'graph'
  | 'audio'
  | 'map'
  | 'diagram'
  | 'project'
  | 'news'
  | 'schedule'
  | 'launcher'
  | 'watch-video'
  | 'file-explorer'
  | 'native-app'
  | 'window-manager'
  | 'sheet'
  | 'docs'
  | 'slides'
  | 'trading-graph'
  | 'image'
  | 'pdf'
  | 'video'
  | '3d'
  | '3d-studio'
  | 'flow'
  | 'list'
  | 'command-inbox'
  | 'notifications'
  | 'integration-registry'
  | 'agent-control'
  | 'agent-console'
  | 'hermes-hud'
  | 'home-systems'
  | 'goals'
  | 'app-portal'
  | 'json-surface';

export type WorkspaceWidget = {
  id: string;
  kind: WidgetKind;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  surfaceAlpha: number;
  lineAlpha: number;
  open: boolean;
  minWidth: number;
  minHeight: number;
  pinned?: boolean;
  hidden?: boolean;
  previewFileId?: string | null;
};

export const workspaceWidgetKinds: WidgetKind[] = [
  'overview',
  'graph',
  'audio',
  'map',
  'diagram',
  'project',
  'news',
  'schedule',
  'launcher',
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
  'command-inbox',
  'notifications',
  'integration-registry',
  'agent-control',
  'agent-console',
  'hermes-hud',
  'home-systems',
  'goals',
  'app-portal',
  'json-surface',
];

export function isWorkspaceWidgetKind(value: string): value is WidgetKind {
  return workspaceWidgetKinds.includes(value as WidgetKind);
}
