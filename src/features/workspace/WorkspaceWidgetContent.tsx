import type { ReactNode } from 'react';

import type { LocalFileRecord, LocalFolderEntry } from './workspaceLocalFiles';
import type { ShellRole } from '../shell/roles';
import type { AgentControlState } from '../agent-control';
import type { AgentTaskGateway } from '../agent-tasking';
import type { MissionControlRuntime } from '../mission-control';
import type { WorkspaceWidgetGroup } from './workspaceManagerModel';
import type { MarketGraph } from './workspaceMarketData';
import type { MarketLiveState } from './workspaceMarketLiveData';
import type { WorkspaceWidget } from './workspaceTypes';
import type { WorkspaceWidgetPermissionMatrix } from './workspaceWidgetPermissions';
import { WidgetScrollPane } from './workspaceBlocks';
import { WorkspaceWidgetWorkflowCue } from './WorkspaceWidgetWorkflowCue';
import {
  AudioWidget,
  AgentConsoleWidget,
  AgentControlWidget,
  BrowserWidget,
  CommandInboxWidget,
  DiagramWidget,
  DocsWidget,
  FileExplorerWidget,
  GraphWidget,
  HomeSystemsWidget,
  ImageWidget,
  IntegrationRegistryWidget,
  LauncherWidget,
  ListWidget,
  LiveTvWidget,
  MapWidget,
  ModelStudioWidget,
  NativeAppWidget,
  NewsWidget,
  NotificationsWidget,
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
  marketLiveData: MarketLiveState;
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
  missionControl: MissionControlRuntime;
  agentControl: AgentControlState;
  agentTaskGateway: AgentTaskGateway;
  activeRole: ShellRole;
  widgetPermissions: WorkspaceWidgetPermissionMatrix;
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
  audio: () => <AudioWidget />,
  map: () => <MapWidget />,
  diagram: () => <DiagramWidget />,
  browser: () => <BrowserWidget />,
  'watch-video': () => <LiveTvWidget />,
  'native-app': () => <NativeAppWidget />,
  video: () => <VideoWidget />,
  '3d-studio': () => <ModelStudioWidget />,
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
  marketLiveData,
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
  missionControl,
  agentControl,
  agentTaskGateway,
  activeRole,
  widgetPermissions,
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
      return <TradingGraphWidget graph={activeMarketGraph} marketLiveData={marketLiveData} />;
    case 'news':
      return <NewsWidget activeGraph={activeMarketGraph} marketLiveData={marketLiveData} onSelectGraph={onSelectMarketGraph} />;
    case 'project':
      return <ProjectWidget onLaunchWorkspaceWidget={onLaunchWorkspaceWidget} />;
    case 'schedule':
      return <ScheduleWidget onLaunchWorkspaceWidget={onLaunchWorkspaceWidget} />;
    case 'list':
      return <ListWidget onLaunchWorkspaceWidget={onLaunchWorkspaceWidget} />;
    case 'image': {
      const imageFile =
        localFiles.find((record) => record.id === activeLocalFileId && record.previewKind === 'image') ??
        localFiles.find((record) => record.id === selectedLocalFileId && record.previewKind === 'image') ??
        localFiles.find((record) => record.previewKind === 'image') ??
        null;
      return <ImageWidget file={imageFile} />;
    }
    case 'pdf': {
      const pdfFile =
        localFiles.find((record) => record.id === activeLocalFileId && record.previewKind === 'pdf') ??
        localFiles.find((record) => record.id === selectedLocalFileId && record.previewKind === 'pdf') ??
        localFiles.find((record) => record.previewKind === 'pdf') ??
        null;
      return <PdfWidget file={pdfFile} />;
    }
    case 'launcher':
      return (
        <LauncherWidget
          onLaunchWorkspaceWidget={onLaunchWorkspaceWidget}
          workspaceWidgets={workspaceWidgets}
          activeRole={activeRole}
          widgetPermissions={widgetPermissions}
        />
      );
    case 'window-manager':
      return (
        <WindowManagerWidget
          workspaceGroups={workspaceWidgetGroups}
          onFocusWidget={onFocusWidget}
          onTogglePinWidget={onTogglePinWidget}
          onCloseWidget={onCloseWidget}
        />
      );
    case 'command-inbox':
      return <CommandInboxWidget missionControl={missionControl} />;
    case 'notifications':
      return <NotificationsWidget missionControl={missionControl} />;
    case 'integration-registry':
      return <IntegrationRegistryWidget missionControl={missionControl} />;
    case 'agent-control':
      return <AgentControlWidget state={agentControl} role={activeRole} missionControl={missionControl} />;
    case 'agent-console':
      return <AgentConsoleWidget role={activeRole} missionControl={missionControl} agentControl={agentControl} taskGateway={agentTaskGateway} />;
    case 'home-systems':
      return <HomeSystemsWidget role={activeRole} missionControl={missionControl} />;
    case 'flow':
      return <WorkflowWidget role={activeRole} missionControl={missionControl} agentControl={agentControl} />;
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
  const showWorkflowCue = props.widget.open && !props.widget.hidden;

  return (
    <WidgetScrollPane>
      {showWorkflowCue ? <WorkspaceWidgetWorkflowCue kind={props.widget.kind} /> : null}
      {renderWorkspaceWidgetContent(props)}
    </WidgetScrollPane>
  );
}
