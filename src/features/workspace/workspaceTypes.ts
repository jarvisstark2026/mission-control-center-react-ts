export type WidgetKind =
  | 'overview'
  | 'graph'
  | 'audio'
  | 'map'
  | 'diagram'
  | 'project'
  | 'news'
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
  depth: number;
  hue: number;
  open: boolean;
  pinned?: boolean;
};
