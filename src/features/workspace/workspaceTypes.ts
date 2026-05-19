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
  | 'browser'
  | 'watch-video'
  | 'file-explorer'
  | 'native-app'
  | 'video'
  | '3d'
  | 'flow'
  | 'list';

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
};
