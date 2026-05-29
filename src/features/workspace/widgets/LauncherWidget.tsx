import { useState } from 'react';
import type { ShellRole } from '../../shell/roles';
import { DesktopBridgePanel } from '../DesktopBridgePanel';
import { WorkspaceCatalogGrid, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { defaultDesktopApps, rememberDesktopApp, type DesktopAppRecord } from '../workspaceDesktopApps';
import { isWorkspaceWidgetKind, type WorkspaceWidget } from '../workspaceTypes';
import { getWidgetLabel, getWorkspaceLauncherEntries } from '../workspaceWidgetCatalog';
import type { WorkspaceWidgetPermissionMatrix } from '../workspaceWidgetPermissions';

type LauncherWidgetProps = {
  onLaunchWorkspaceWidget: (kind: WorkspaceWidget['kind']) => void;
  workspaceWidgets: WorkspaceWidget[];
  activeRole: ShellRole;
  widgetPermissions: WorkspaceWidgetPermissionMatrix;
};

export function LauncherWidget({ onLaunchWorkspaceWidget, workspaceWidgets, activeRole, widgetPermissions }: LauncherWidgetProps) {
  const [desktopCommand, setDesktopCommand] = useState('');
  const [desktopApps, setDesktopApps] = useState<DesktopAppRecord[]>(defaultDesktopApps);

  const workspaceApps = getWorkspaceLauncherEntries(activeRole, widgetPermissions);

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
      <WorkspaceStatusStrip
        source="local"
        status="open or focus workspace tools"
        count={`${workspaceCards.filter((card) => card.active).length} open`}
        updatedAt={`${desktopApps.length} app profiles`}
      />

      <WorkspaceSectionFrame className="launcher-desktop-section" eyebrow="external handoff" meta="saved links and shortcuts">
        <DesktopBridgePanel
          eyebrow="launch profiles"
          title="save external app targets"
          description="Remember web, protocol, or manual desktop targets without executing arbitrary paths inside Mission Control."
          inputLabel="External target"
          inputValue={desktopCommand}
          inputPlaceholder="e.g. explorer.exe, obsidian, notepad.exe"
          submitLabel="Save profile"
          apps={desktopApps}
          appsLabel="saved launch profiles"
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
