import type { ReactNode } from 'react';

import type { LocalFileRecord, LocalFolderEntry } from './workspaceLocalFiles';
import type { WorkspaceWidgetGroup } from './workspaceManagerModel';
import type { MarketGraph } from './workspaceMarketData';
import type { WorkspaceWidget } from './workspaceTypes';
import { WidgetScrollPane } from './workspaceBlocks';
import {
  AudioWidget,
  BrowserWidget,
  DiagramWidget,
  DocsWidget,
  FileExplorerWidget,
  GraphWidget,
  ImageWidget,
  LauncherWidget,
  ListWidget,
  LiveTvWidget,
  MapWidget,
  ModelStudioWidget,
  NativeAppWidget,
  NewsWidget,
  OverviewWidget,
  PdfWidget,
  PreviewWidget,
  ProjectWidget,
  ScheduleWidget,
  SlidesWidget,
  SpreadsheetWidget,
  TradingGraphWidget,
  VideoWidget,
  WindowManagerWidget,
  WorkflowWidget,
} from './widgets';

export type WorkspaceWidgetContentProps = {
  localFiles: LocalFileRecord[];
  activeLocalFileId: string | null;
  selectedLocalFileId: string | null;
  folderEntries: LocalFolderEntry[];
  folderPath: string | null;
  canBrowseFolder: boolean;
  activeMarketGraph: MarketGraph;
  onBrowseFiles: (files: FileList | File[]) => Promise<LocalFileRecord[]>;
  onBrowseFolder: () => void;
  onOpenPreview: (file: LocalFileRecord) => void;
  onSelectFile: (id: string | null) => void;
  onClearFiles: () => void;
  onLaunchWorkspaceWidget: (kind: WorkspaceWidget['kind']) => void;
  onSelectMarketGraph: (graph: MarketGraph) => void;
  workspaceWidgets: WorkspaceWidget[];
  workspaceWidgetGroups: WorkspaceWidgetGroup[];
  onFocusWidget: (id: string) => void;
  onTogglePinWidget: (id: string) => void;
  onCloseWidget: (id: string) => void;
};

type WorkspaceWidgetContentRendererProps = {
  widget: WorkspaceWidget;
} & WorkspaceWidgetContentProps;

const staticWidgetRenderers: Partial<Record<WorkspaceWidget['kind'], () => ReactNode>> = {
  overview: () => <OverviewWidget />,
  graph: () => <GraphWidget />,
  sheet: () => <SpreadsheetWidget />,
  docs: () => <DocsWidget />,
  slides: () => <SlidesWidget />,
  image: () => <ImageWidget />,
  pdf: () => <PdfWidget />,
  audio: () => <AudioWidget />,
  map: () => <MapWidget />,
  diagram: () => <DiagramWidget />,
  project: () => <ProjectWidget />,
  schedule: () => <ScheduleWidget />,
  browser: () => <BrowserWidget />,
  'watch-video': () => <LiveTvWidget />,
  'native-app': () => <NativeAppWidget />,
  video: () => <VideoWidget />,
  '3d-studio': () => <ModelStudioWidget />,
  flow: () => <WorkflowWidget />,
  list: () => <ListWidget />,
};

function renderWorkspaceWidgetContent({
  widget,
  localFiles,
  activeLocalFileId,
  selectedLocalFileId,
  folderEntries,
  folderPath,
  canBrowseFolder,
  activeMarketGraph,
  onBrowseFiles,
  onBrowseFolder,
  onOpenPreview,
  onSelectFile,
  onClearFiles,
  onLaunchWorkspaceWidget,
  onSelectMarketGraph,
  workspaceWidgets,
  workspaceWidgetGroups,
  onFocusWidget,
  onTogglePinWidget,
  onCloseWidget,
}: WorkspaceWidgetContentRendererProps) {
  switch (widget.kind) {
    case 'file-explorer':
      return (
        <FileExplorerWidget
          files={localFiles}
          activeFileId={activeLocalFileId}
          selectedFileId={selectedLocalFileId}
          folderEntries={folderEntries}
          folderPath={folderPath}
          canBrowseFolder={canBrowseFolder}
          onBrowseFiles={onBrowseFiles}
          onBrowseFolder={onBrowseFolder}
          onOpenPreview={onOpenPreview}
          onSelectFile={onSelectFile}
          onClearFiles={onClearFiles}
        />
      );
    case 'trading-graph':
      return <TradingGraphWidget graph={activeMarketGraph} />;
    case 'news':
      return <NewsWidget activeGraph={activeMarketGraph} onSelectGraph={onSelectMarketGraph} />;
    case 'launcher':
      return <LauncherWidget onLaunchWorkspaceWidget={onLaunchWorkspaceWidget} workspaceWidgets={workspaceWidgets} />;
    case 'window-manager':
      return (
        <WindowManagerWidget
          workspaceGroups={workspaceWidgetGroups}
          onFocusWidget={onFocusWidget}
          onTogglePinWidget={onTogglePinWidget}
          onCloseWidget={onCloseWidget}
        />
      );
    case '3d': {
      const previewFile = widget.previewFileId ? localFiles.find((record) => record.id === widget.previewFileId) ?? null : null;
      return <PreviewWidget file={previewFile} onBrowseFiles={onBrowseFiles} onOpenPreview={onOpenPreview} />;
    }
    default: {
      const renderStaticWidget = staticWidgetRenderers[widget.kind];
      return renderStaticWidget ? renderStaticWidget() : null;
    }
  }
}

export function WorkspaceWidgetContent(props: WorkspaceWidgetContentRendererProps) {
  return <WidgetScrollPane>{renderWorkspaceWidgetContent(props)}</WidgetScrollPane>;
}
