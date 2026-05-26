import { useState } from 'react';
import { DesktopBridgePanel } from '../DesktopBridgePanel';
import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
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
        title="installed app launcher"
        metaEyebrow="local"
        meta="external windows"
      />

      <WorkspaceStatusStrip source="local" status="external app launch profiles" count={`${apps.length} remembered`} updatedAt="desktop handoff" />

      <WorkspaceSectionFrame className="native-app-bridge-section" eyebrow="desktop controls" title="app command" meta={`${apps.length} remembered`}>
        <DesktopBridgePanel
          eyebrow="desktop bridge"
          title="open installed app / external window"
          description="Launch installed apps through local profiles. Native embedding is intentionally not promised in this surface."
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
