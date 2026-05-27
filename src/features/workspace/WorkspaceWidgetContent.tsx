import type { ReactNode } from 'react';

import type { LocalFileRecord, LocalFolderEntry } from './workspaceLocalFiles';
import type { ShellRole } from '../shell/roles';
import type { AgentBridgeProbeResult, AgentControlState } from '../agent-control';
import type { AgentBridgeSettings } from '../agent-control';
import type { AgentTaskGateway } from '../agent-tasking';
import type { MissionControlRuntime } from '../mission-control';
import type { OperationalOsRuntime } from '../operational-os';
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
  AppPortalWidget,
  BrowserWidget,
  CommandInboxWidget,
  DiagramWidget,
  DocsWidget,
  FileExplorerWidget,
  GraphWidget,
  GoalsWidget,
  HomeSystemsWidget,
  ImageWidget,
  IntegrationRegistryWidget,
  JsonSurfaceWidget,
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
  focusedCommandId?: string | null;
  onOpenCommandInbox?: (commandId?: string) => void;
  onClearFocusedCommand?: () => void;
  onSelectMarketGraph: (graph: MarketGraph) => void;
  workspaceWidgets: WorkspaceWidget[];
  workspaceWidgetGroups: WorkspaceWidgetGroup[];
  onFocusWidget: (id: string) => void;
  onTogglePinWidget: (id: string) => void;
  onCloseWidget: (id: string) => void;
  missionControl: MissionControlRuntime;
  agentControl: AgentControlState;
  agentBridgeSettings: AgentBridgeSettings;
  onUpdateAgentBridgeSettings: (settings: Partial<AgentBridgeSettings>) => void;
  onProbeAgentBridge: () => Promise<AgentBridgeProbeResult[]>;
  onTestAgentBridgeUrl: (url: string) => Promise<AgentBridgeProbeResult>;
  agentTaskGateway: AgentTaskGateway;
  operationalOs: OperationalOsRuntime;
  activeRole: ShellRole;
  widgetPermissions: WorkspaceWidgetPermissionMatrix;
};

type WorkspaceWidgetContentRendererProps = {
  widget: WorkspaceWidget;
} & WorkspaceWidgetContentProps;

const staticWidgetRenderers: Partial<Record<WorkspaceWidget['kind'], (props: WorkspaceWidgetContentRendererProps) => ReactNode>> = {
  overview: ({ missionControl, workspaceWidgetGroups, activeRole, operationalOs }) => (
    <OverviewWidget missionControl={missionControl} workspaceGroups={workspaceWidgetGroups} role={activeRole} operationalOs={operationalOs} />
  ),
  graph: ({ missionControl, activeRole, operationalOs }) => <GraphWidget missionControl={missionControl} role={activeRole} operationalOs={operationalOs} />,
  sheet: ({ activeRole, operationalOs }) => <SpreadsheetWidget role={activeRole} operationalOs={operationalOs} />,
  docs: ({ activeRole, operationalOs }) => <DocsWidget role={activeRole} operationalOs={operationalOs} />,
  slides: ({ activeRole, operationalOs }) => <SlidesWidget role={activeRole} operationalOs={operationalOs} />,
  audio: ({ agentControl, localFiles, activeLocalFileId, selectedLocalFileId, onBrowseFiles, onOpenPreview }) => (
    <AudioWidget
      agentControl={agentControl}
      files={localFiles}
      activeFileId={activeLocalFileId}
      selectedFileId={selectedLocalFileId}
      onBrowseFiles={onBrowseFiles}
      onOpenPreview={onOpenPreview}
    />
  ),
  map: () => <MapWidget />,
  diagram: () => <DiagramWidget />,
  browser: ({ activeRole, operationalOs }) => <BrowserWidget role={activeRole} operationalOs={operationalOs} />,
  'watch-video': () => <LiveTvWidget />,
  'native-app': () => <NativeAppWidget />,
  video: ({ localFiles, activeLocalFileId, selectedLocalFileId, onBrowseFiles, onOpenPreview }) => (
    <VideoWidget
      files={localFiles}
      activeFileId={activeLocalFileId}
      selectedFileId={selectedLocalFileId}
      onBrowseFiles={onBrowseFiles}
      onOpenPreview={onOpenPreview}
    />
  ),
  '3d-studio': ({ localFiles, activeLocalFileId, selectedLocalFileId, onBrowseFiles, onOpenPreview, activeRole, operationalOs }) => (
    <ModelStudioWidget
      files={localFiles}
      activeFileId={activeLocalFileId}
      selectedFileId={selectedLocalFileId}
      onBrowseFiles={onBrowseFiles}
      onOpenPreview={onOpenPreview}
      role={activeRole}
      operationalOs={operationalOs}
    />
  ),
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
  focusedCommandId,
  onOpenCommandInbox,
  onClearFocusedCommand,
  onSelectMarketGraph,
  workspaceWidgets,
  workspaceWidgetGroups,
  onFocusWidget,
  onTogglePinWidget,
  onCloseWidget,
  missionControl,
  agentControl,
  agentBridgeSettings,
  onUpdateAgentBridgeSettings,
  onProbeAgentBridge,
  onTestAgentBridgeUrl,
  agentTaskGateway,
  operationalOs,
  activeRole,
  widgetPermissions,
}: WorkspaceWidgetContentRendererProps) {
  switch (widget.kind) {
    case 'file-explorer':
      return (
        <FileExplorerWidget
          role={activeRole}
          operationalOs={operationalOs}
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
      return <TradingGraphWidget graph={activeMarketGraph} marketLiveData={marketLiveData} role={activeRole} operationalOs={operationalOs} />;
    case 'news':
      return <NewsWidget activeGraph={activeMarketGraph} marketLiveData={marketLiveData} onSelectGraph={onSelectMarketGraph} role={activeRole} operationalOs={operationalOs} />;
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
      return <ImageWidget file={imageFile} role={activeRole} operationalOs={operationalOs} />;
    }
    case 'pdf': {
      const pdfFile =
        localFiles.find((record) => record.id === activeLocalFileId && record.previewKind === 'pdf') ??
        localFiles.find((record) => record.id === selectedLocalFileId && record.previewKind === 'pdf') ??
        localFiles.find((record) => record.previewKind === 'pdf') ??
        null;
      return <PdfWidget file={pdfFile} role={activeRole} operationalOs={operationalOs} />;
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
      return (
        <CommandInboxWidget
          missionControl={missionControl}
          operationalOs={operationalOs}
          focusedCommandId={focusedCommandId}
          onClearFocusedCommand={onClearFocusedCommand}
        />
      );
    case 'notifications':
      return <NotificationsWidget missionControl={missionControl} role={activeRole} operationalOs={operationalOs} />;
    case 'integration-registry':
      return <IntegrationRegistryWidget missionControl={missionControl} role={activeRole} operationalOs={operationalOs} />;
    case 'agent-control':
      return (
        <AgentControlWidget
          state={agentControl}
          role={activeRole}
          missionControl={missionControl}
          bridgeSettings={agentBridgeSettings}
          onUpdateBridgeSettings={onUpdateAgentBridgeSettings}
          onProbeBridge={onProbeAgentBridge}
          onTestBridgeUrl={onTestAgentBridgeUrl}
          taskGateway={agentTaskGateway}
        />
      );
    case 'agent-console':
      return (
        <AgentConsoleWidget
          role={activeRole}
          missionControl={missionControl}
          agentControl={agentControl}
          taskGateway={agentTaskGateway}
          operationalOs={operationalOs}
          bridgeSettings={agentBridgeSettings}
          onOpenCommandInbox={onOpenCommandInbox}
        />
      );
    case 'home-systems':
      return <HomeSystemsWidget role={activeRole} missionControl={missionControl} operationalOs={operationalOs} />;
    case 'flow':
      return (
        <WorkflowWidget
          role={activeRole}
          missionControl={missionControl}
          agentControl={agentControl}
          operationalOs={operationalOs}
          taskGateway={agentTaskGateway}
        />
      );
    case 'goals':
      return (
        <GoalsWidget
          role={activeRole}
          missionControl={missionControl}
          agentControl={agentControl}
          operationalOs={operationalOs}
          onLaunchWorkspaceWidget={onLaunchWorkspaceWidget}
        />
      );
    case 'app-portal':
      return <AppPortalWidget role={activeRole} operationalOs={operationalOs} />;
    case 'json-surface':
      return <JsonSurfaceWidget role={activeRole} operationalOs={operationalOs} missionControl={missionControl} />;
    case '3d': {
      const previewFile = widget.previewFileId ? localFiles.find((record) => record.id === widget.previewFileId) ?? null : null;
      return <PreviewWidget file={previewFile} onBrowseFiles={onBrowseFiles} onOpenPreview={onOpenPreview} role={activeRole} operationalOs={operationalOs} />;
    }
    default: {
      const renderStaticWidget = staticWidgetRenderers[widget.kind];
      return renderStaticWidget ? renderStaticWidget({
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
        focusedCommandId,
        onOpenCommandInbox,
        onClearFocusedCommand,
        onSelectMarketGraph,
        workspaceWidgets,
        workspaceWidgetGroups,
        onFocusWidget,
        onTogglePinWidget,
        onCloseWidget,
        missionControl,
        agentControl,
        agentBridgeSettings,
        onUpdateAgentBridgeSettings,
        onProbeAgentBridge,
        onTestAgentBridgeUrl,
        agentTaskGateway,
        operationalOs,
        activeRole,
        widgetPermissions,
      }) : null;
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
