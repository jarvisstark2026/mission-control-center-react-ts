import { useMemo, useState } from 'react';

import { canUseAppProfile, type AppPortalProfile, type OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';
import { AttentionCard, EvidenceBlock } from '../operationalBlocks';
import { WorkspaceButton, WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';

function formatTime(value?: string) {
  if (!value) return 'not opened';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(time));
}

function canEmbed(profile: AppPortalProfile) {
  return profile.type === 'web' && profile.embedMode === 'iframe' && /^https?:\/\//iu.test(profile.launchTarget);
}

export function AppPortalWidget({ role, operationalOs }: { role: ShellRole; operationalOs: OperationalOsRuntime }) {
  const visibleProfiles = useMemo(
    () => operationalOs.state.appProfiles.filter((profile) => canUseAppProfile(profile, role)),
    [operationalOs.state.appProfiles, role],
  );
  const [activeProfileId, setActiveProfileId] = useState(visibleProfiles[0]?.id ?? '');
  const activeProfile = visibleProfiles.find((profile) => profile.id === activeProfileId) ?? visibleProfiles[0] ?? null;
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState('Open tools without leaving the Mission Control operating surface.');

  const openProfile = (profile: AppPortalProfile) => {
    operationalOs.markAppProfileOpened(profile.id);
    setActiveProfileId(profile.id);

    if (canEmbed(profile)) {
      setStatus(`${profile.name} loaded inside the App Portal.`);
      return;
    }

    const opened = window.open(profile.launchTarget, '_blank', 'noopener,noreferrer');
    setStatus(opened ? `${profile.name} opened as an external or tracked app.` : `${profile.name} could not be opened automatically. Use the launch target manually.`);
  };

  const addProfile = () => {
    if (!name.trim() || !target.trim()) return;
    const profile = operationalOs.addAppProfile({
      name,
      type: /^https?:\/\//iu.test(target) ? 'web' : target.includes('://') ? 'protocol' : 'desktop',
      launchTarget: target,
      embedMode: /^https?:\/\//iu.test(target) ? 'iframe' : 'external-window',
      allowedRoles: ['admin', 'support', 'home'],
    });
    setActiveProfileId(profile.id);
    setName('');
    setTarget('');
    setStatus(`${profile.name} added to App Portal.`);
  };

  return (
      <WorkspaceContentShell className="mission-control-surface app-portal-surface">
      <WorkspaceContentHeader eyebrow="App Portal" title="embedded tools / launch profiles" metaEyebrow="mode" meta={activeProfile?.embedMode ?? 'empty'} />
      <WorkspaceStatusStrip
        source="local"
        status={status}
        count={`${visibleProfiles.length} profiles`}
        updatedAt={activeProfile ? formatTime(activeProfile.lastOpenedAt) : 'not opened'}
      />

      {activeProfile ? (
        <AttentionCard
          label={`${activeProfile.type} / ${activeProfile.embedMode}`}
          title={activeProfile.name}
          risk={canEmbed(activeProfile) ? 'online' : 'notice'}
          actions={<WorkspaceButton variant="primary" onClick={() => openProfile(activeProfile)}>Open profile</WorkspaceButton>}
        >
          <EvidenceBlock label="launch target" title={activeProfile.launchTarget}>
            Last opened {formatTime(activeProfile.lastOpenedAt)}. Arbitrary native app embedding remains experimental; v1 launches and tracks intent.
          </EvidenceBlock>
        </AttentionCard>
      ) : null}

      <WorkspaceSectionFrame className="mission-control-list-frame" eyebrow="profiles" title="apps and tools" meta={`${visibleProfiles.length} visible`}>
        <WorkspaceCatalogGrid
          className="app-portal-grid"
          variant="desktop"
          ariaLabel="App Portal profiles"
          items={visibleProfiles.map((profile) => ({
            id: profile.id,
            label: profile.name,
            note: profile.launchTarget,
            badge: profile.embedMode,
            active: activeProfile?.id === profile.id,
          }))}
          onSelect={(item) => setActiveProfileId(item.id)}
          onDoubleSelect={(item) => {
            const profile = visibleProfiles.find((entry) => entry.id === item.id);
            if (profile) openProfile(profile);
          }}
        />
      </WorkspaceSectionFrame>

      {activeProfile && canEmbed(activeProfile) ? (
        <WorkspaceSectionFrame className="app-portal-embed-frame" eyebrow="embedded view" title={activeProfile.name} meta="iframe">
          <iframe title={activeProfile.name} src={activeProfile.launchTarget} sandbox="allow-forms allow-scripts allow-same-origin allow-popups" />
        </WorkspaceSectionFrame>
      ) : null}

      {role === 'admin' ? (
        <WorkspaceSectionFrame className="mission-control-list-frame app-portal-create" eyebrow="add profile" title="local tool shortcut" meta="local only">
          <label className="goals-field">
            <span>name</span>
            <input value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="Hermes dashboard, Obsidian, local tool..." />
          </label>
          <label className="goals-field">
            <span>target</span>
            <input value={target} onChange={(event) => setTarget(event.currentTarget.value)} placeholder="https://... or app:// or command name" />
          </label>
          <WorkspaceButton variant="secondary" disabled={!name.trim() || !target.trim()} onClick={addProfile}>
            Add app profile
          </WorkspaceButton>
        </WorkspaceSectionFrame>
      ) : null}
    </WorkspaceContentShell>
  );
}
