import { useState } from 'react';
import { DesktopBridgePanel } from '../DesktopBridgePanel';
import { WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { defaultDesktopApps, rememberDesktopApp, type DesktopAppRecord } from '../workspaceDesktopApps';
import { isWorkspaceWidgetKind, type WorkspaceWidget } from '../workspaceTypes';
import { getWidgetLabel, getWorkspaceLauncherEntries } from '../workspaceWidgetCatalog';

type LauncherWidgetProps = {
  onLaunchWorkspaceWidget: (kind: WorkspaceWidget['kind']) => void;
  workspaceWidgets: WorkspaceWidget[];
};

export function LauncherWidget({ onLaunchWorkspaceWidget, workspaceWidgets }: LauncherWidgetProps) {
  const [desktopCommand, setDesktopCommand] = useState('');
  const [desktopApps, setDesktopApps] = useState<DesktopAppRecord[]>(defaultDesktopApps);

  const workspaceApps = getWorkspaceLauncherEntries();

  const openInstalledApp = () => {
    const nextName = desktopCommand.trim();
    if (!nextName) return;
    setDesktopApps((current) => rememberDesktopApp(current, nextName));
    setDesktopCommand('');
  };

  const recallInstalledApp = (app: DesktopAppRecord) => {
    setDesktopCommand(app.name);
    setDesktopApps((current) => rememberDesktopApp(current, app.name, { note: app.note }));
  };

  const getAppState = (kind: WorkspaceWidget['kind']) => {
    const widget = workspaceWidgets.find((item) => item.kind === kind);
    if (!widget) return 'closed';
    return widget.open ? 'open' : 'closed';
  };

  const workspaceCards = workspaceApps.map((app) => {
    const state = getAppState(app.kind);

    return {
      id: app.kind,
      label: getWidgetLabel(app.kind),
      note: state === 'open' ? 'open - double-click to focus' : 'double-click to open',
      badge: state,
      active: state === 'open',
      state,
    };
  });

  return (
    <WorkspaceContentShell className="launcher-surface">
      <WorkspaceContentHeader
        className="launcher-head"
        eyebrow="Workspace launcher"
        title="open installed apps into the workspace"
        metaEyebrow="command bridge"
        meta="launch / focus / stay in the workspace"
      />

      <WorkspaceSummaryPanel className="launcher-summary-panel" title="workspace hooks">
        Open or focus widgets in the workspace, with external apps routed through the same desktop bridge.
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame className="launcher-desktop-section" eyebrow="desktop bridge" meta="installed apps and shortcuts">
        <DesktopBridgePanel
          eyebrow="installed apps"
          title="load installed apps into memory"
          description="Command line stays available while installed apps remain linked to the workspace launcher."
          inputLabel="Installed app or command"
          inputValue={desktopCommand}
          inputPlaceholder="e.g. explorer.exe, obsidian, notepad.exe"
          submitLabel="Open installed app"
          apps={desktopApps}
          appsLabel="installed app list"
          onChangeInput={setDesktopCommand}
          onSubmit={openInstalledApp}
          onSelectApp={recallInstalledApp}
        >
          <WorkspaceCatalogGrid
            className="launcher-grid"
            variant="launcher"
            ariaLabel="Workspace launch shortcuts"
            items={workspaceCards}
            onDoubleSelect={(item) => {
              if (isWorkspaceWidgetKind(item.id)) {
                onLaunchWorkspaceWidget(item.id);
              }
            }}
          />
        </DesktopBridgePanel>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

