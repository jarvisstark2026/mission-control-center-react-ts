import { useState } from 'react';
import { DesktopBridgePanel, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { defaultDesktopApps, rememberDesktopApp, type DesktopAppRecord } from '../workspaceDesktopApps';

export function NativeAppWidget() {
  const [desktopCommand, setDesktopCommand] = useState('');
  const [apps, setApps] = useState<DesktopAppRecord[]>(defaultDesktopApps);

  const openInstalledApp = () => {
    const nextName = desktopCommand.trim();
    if (!nextName) return;
    setApps((current) => rememberDesktopApp(current, nextName));
    setDesktopCommand('');
  };

  const recallInstalledApp = (app: DesktopAppRecord) => {
    setDesktopCommand(app.name);
    setApps((current) => rememberDesktopApp(current, app.name, { note: app.note }));
  };

  return (
    <WorkspaceContentShell className="native-app-surface">
      <WorkspaceContentHeader
        eyebrow="Desktop bridge"
        title="open installed app / external window"
        metaEyebrow="local"
        meta="installed apps"
      />

      <WorkspaceSummaryPanel className="native-app-summary" title="bridge status">
        Browser containment remains intact; operating-system ambitions are routed through the external app bridge.
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame className="native-app-bridge-section" eyebrow="desktop controls" title="app command" meta={`${apps.length} remembered`}>
        <DesktopBridgePanel
          eyebrow="desktop bridge"
          title="open installed app / external window"
          description="Bridge installed apps and external windows without pretending the browser can do an operating systemâ€™s job on its own."
          inputLabel="App or command"
          inputValue={desktopCommand}
          inputPlaceholder="e.g. obsidian, explorer.exe, notepad.exe"
          submitLabel="Open app"
          apps={apps}
          onChangeInput={setDesktopCommand}
          onSubmit={openInstalledApp}
          onSelectApp={recallInstalledApp}
          className="native-app-bridge"
        />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

