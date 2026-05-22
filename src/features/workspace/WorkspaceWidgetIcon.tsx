import type { WidgetKind } from './workspaceTypes';

type WidgetIconDefinition = {
  viewBox?: string;
  paths: string[];
};

const widgetIconDefinitions: Record<WidgetKind, WidgetIconDefinition> = {
  overview: {
    paths: [
      'M4 4h16v16H4z',
      'M8 8h8',
      'M8 12h5',
      'M8 16h8',
    ],
  },
  graph: {
    paths: [
      'M4 18h16',
      'M6 15l3-4 3 2 4-7 3 5',
    ],
  },
  audio: {
    paths: [
      'M5 14h3l4 4V6L8 10H5z',
      'M16 9c1 2 1 4 0 6',
      'M19 7c2 3 2 7 0 10',
    ],
  },
  map: {
    paths: [
      'M5 6l5-2 4 2 5-2v14l-5 2-4-2-5 2z',
      'M10 4v14',
      'M14 6v14',
    ],
  },
  diagram: {
    paths: [
      'M6 7h5v5H6z',
      'M14 12h5v5h-5z',
      'M11 10l3 3',
      'M9 12v5h5',
    ],
  },
  project: {
    paths: [
      'M5 6h14',
      'M5 12h14',
      'M5 18h10',
      'M7 6v12',
    ],
  },
  news: {
    paths: [
      'M4 17l4-5 3 3 5-7 4 5',
      'M4 20h16',
      'M4 4h16',
    ],
  },
  schedule: {
    paths: [
      'M5 7h14v13H5z',
      'M8 4v4',
      'M16 4v4',
      'M5 11h14',
      'M8 15h3',
      'M13 15h3',
    ],
  },
  launcher: {
    paths: [
      'M5 5h5v5H5z',
      'M14 5h5v5h-5z',
      'M5 14h5v5H5z',
      'M14 14h5v5h-5z',
    ],
  },
  browser: {
    paths: [
      'M4 6h16v13H4z',
      'M4 10h16',
      'M7 8h.1',
      'M10 8h.1',
    ],
  },
  'watch-video': {
    paths: [
      'M4 7h16v11H4z',
      'M10 10l5 2.5-5 2.5z',
      'M8 20h8',
    ],
  },
  'file-explorer': {
    paths: [
      'M4 7h6l2 2h8v10H4z',
      'M4 11h16',
    ],
  },
  'native-app': {
    paths: [
      'M8 5v5',
      'M16 5v5',
      'M7 10h10v3a5 5 0 0 1-10 0z',
      'M12 18v3',
    ],
  },
  'window-manager': {
    paths: [
      'M5 5h6v6H5z',
      'M13 5h6v6h-6z',
      'M5 13h6v6H5z',
      'M13 13h6v6h-6z',
      'M8 8h8',
      'M8 16h8',
    ],
  },
  sheet: {
    paths: [
      'M5 4h14v16H5z',
      'M5 9h14',
      'M5 14h14',
      'M10 4v16',
      'M15 4v16',
    ],
  },
  docs: {
    paths: [
      'M7 4h8l4 4v12H7z',
      'M15 4v5h4',
      'M10 13h6',
      'M10 17h6',
    ],
  },
  slides: {
    paths: [
      'M5 5h14v10H5z',
      'M9 19h6',
      'M12 15v4',
      'M8 9h8',
    ],
  },
  'trading-graph': {
    paths: [
      'M6 7v10',
      'M10 4v13',
      'M14 8v10',
      'M18 5v11',
      'M5 12h2',
      'M9 9h2',
      'M13 14h2',
      'M17 10h2',
    ],
  },
  image: {
    paths: [
      'M5 5h14v14H5z',
      'M8 15l3-4 3 3 2-2 3 4',
      'M15 9h.1',
    ],
  },
  pdf: {
    paths: [
      'M7 4h8l4 4v12H7z',
      'M15 4v5h4',
      'M9 15h2',
      'M12 15h2',
      'M15 15h1',
    ],
  },
  video: {
    paths: [
      'M5 6h12v12H5z',
      'M17 10l3-2v8l-3-2z',
      'M10 10l4 2-4 2z',
    ],
  },
  '3d': {
    paths: [
      'M12 4l7 4v8l-7 4-7-4V8z',
      'M12 12l7-4',
      'M12 12v8',
      'M12 12L5 8',
    ],
  },
  '3d-studio': {
    paths: [
      'M7 8l5-3 5 3v6l-5 3-5-3z',
      'M4 17h16',
      'M8 20h8',
      'M12 11l5-3',
      'M12 11v6',
      'M12 11L7 8',
    ],
  },
  flow: {
    paths: [
      'M6 7h5v5H6z',
      'M13 13h5v5h-5z',
      'M11 9h3a3 3 0 0 1 3 3v1',
      'M8 12v2a3 3 0 0 0 3 3h2',
    ],
  },
  list: {
    paths: [
      'M8 7h11',
      'M8 12h11',
      'M8 17h11',
      'M5 7h.1',
      'M5 12h.1',
      'M5 17h.1',
    ],
  },
};

export function WorkspaceWidgetIcon({ kind }: { kind: WidgetKind }) {
  const icon = widgetIconDefinitions[kind];

  return (
    <svg className="widget-kind-icon" viewBox={icon.viewBox ?? '0 0 24 24'} aria-hidden="true" focusable="false">
      {icon.paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
