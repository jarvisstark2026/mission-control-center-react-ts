import type { PointerEvent as ReactPointerEvent } from 'react';

import { classNames } from '../../lib/classNames';
import { WorkspaceWindow } from './WorkspaceWindow';
import type { ResizeEdge } from './WorkspaceResizeHandles';
import type { LocalFileRecord, LocalFolderEntry } from './workspaceLocalFiles';
import type { MarketGraph } from './workspaceMarketData';
import type { WorkspaceWidget } from './workspaceTypes';
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
} from './workspaceWidgetSurfaces';

type WorkspaceWidgetCardProps = {
  widget: WorkspaceWidget;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onStartResize: (event: ReactPointerEvent<HTMLElement>, id: string, edge: ResizeEdge) => void;
  onToggleOpen: (id: string) => void;
  onRecenter: (id: string) => void;
  onClose: (id: string) => void;
  showChrome?: boolean;
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
  onFocusWidget: (id: string) => void;
  onCloseWidget: (id: string) => void;
};

export type WorkspaceWidgetRuntimeProps = Omit<WorkspaceWidgetCardProps, 'widget' | 'showChrome'>;
type WorkspaceWidgetContentProps = Omit<
  WorkspaceWidgetRuntimeProps,
  'onStartDrag' | 'onStartResize' | 'onToggleOpen' | 'onRecenter' | 'onClose'
>;

function WorkspaceWidgetContent({
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
  onFocusWidget,
  onCloseWidget,
}: {
  widget: WorkspaceWidget;
} & WorkspaceWidgetContentProps) {
  const previewFile = widget.previewFileId ? localFiles.find((record) => record.id === widget.previewFileId) ?? null : null;

  if (widget.kind === 'file-explorer') {
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
  }

  return (
    <div className="widget-scroll-pane">
      {widget.kind === 'overview' && <OverviewWidget />}
      {widget.kind === 'graph' && <GraphWidget />}
      {widget.kind === 'trading-graph' && <TradingGraphWidget graph={activeMarketGraph} />}
      {widget.kind === 'sheet' && <SpreadsheetWidget />}
      {widget.kind === 'docs' && <DocsWidget />}
      {widget.kind === 'slides' && <SlidesWidget />}
      {widget.kind === 'image' && <ImageWidget />}
      {widget.kind === 'pdf' && <PdfWidget />}
      {widget.kind === 'audio' && <AudioWidget />}
      {widget.kind === 'map' && <MapWidget />}
      {widget.kind === 'diagram' && <DiagramWidget />}
      {widget.kind === 'project' && <ProjectWidget />}
      {widget.kind === 'news' && <NewsWidget activeGraph={activeMarketGraph} onSelectGraph={onSelectMarketGraph} />}
      {widget.kind === 'schedule' && <ScheduleWidget />}
      {widget.kind === 'launcher' && <LauncherWidget onLaunchWorkspaceWidget={onLaunchWorkspaceWidget} workspaceWidgets={workspaceWidgets} />}
      {widget.kind === 'browser' && <BrowserWidget />}
      {widget.kind === 'watch-video' && <LiveTvWidget />}
      {widget.kind === 'native-app' && <NativeAppWidget />}
      {widget.kind === 'window-manager' && <WindowManagerWidget widgets={workspaceWidgets} onFocusWidget={onFocusWidget} onCloseWidget={onCloseWidget} />}
      {widget.kind === 'video' && <VideoWidget />}
      {widget.kind === '3d' && <PreviewWidget file={previewFile} onBrowseFiles={onBrowseFiles} onOpenPreview={onOpenPreview} />}
      {widget.kind === '3d-studio' && <ModelStudioWidget />}
      {widget.kind === 'flow' && <WorkflowWidget />}
      {widget.kind === 'list' && <ListWidget />}
    </div>
  );
}

export function WorkspaceWidgetCard(props: WorkspaceWidgetCardProps) {
  const {
    widget,
    onStartDrag,
    onStartResize,
    onToggleOpen,
    onRecenter,
    onClose,
    showChrome = true,
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
    onFocusWidget,
    onCloseWidget,
  } = props;

  return (
    <WorkspaceWindow
      widget={widget}
      bodyClassName={classNames(
        'widget-body',
        widget.kind === 'file-explorer' && 'widget-body-file-explorer',
      )}
      onStartDrag={onStartDrag}
      onStartResize={onStartResize}
      onToggleOpen={onToggleOpen}
      onRecenter={onRecenter}
      onClose={onClose}
      showChrome={showChrome}
    >
      <WorkspaceWidgetContent
        widget={widget}
        localFiles={localFiles}
        activeLocalFileId={activeLocalFileId}
        selectedLocalFileId={selectedLocalFileId}
        folderEntries={folderEntries}
        folderPath={folderPath}
        canBrowseFolder={canBrowseFolder}
        activeMarketGraph={activeMarketGraph}
        onBrowseFiles={onBrowseFiles}
        onBrowseFolder={onBrowseFolder}
        onOpenPreview={onOpenPreview}
        onSelectFile={onSelectFile}
        onClearFiles={onClearFiles}
        onLaunchWorkspaceWidget={onLaunchWorkspaceWidget}
        onSelectMarketGraph={onSelectMarketGraph}
        workspaceWidgets={workspaceWidgets}
        onFocusWidget={onFocusWidget}
        onCloseWidget={onCloseWidget}
      />
    </WorkspaceWindow>
  );
}

